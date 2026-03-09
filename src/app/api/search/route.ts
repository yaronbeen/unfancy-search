import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { SearchRequest } from "@/lib/types";
import { expandQuery } from "@/lib/query-expansion";
import { fetchSerpFanOut } from "@/lib/bright-data";
import { reciprocalRankFusion } from "@/lib/rerank";
import { clusterByDomain, applyDomainDiversity } from "@/lib/cluster";
import { kvSet } from "@/lib/kv-store";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";

const SERP_COST_PER_REQUEST = 0.0015;
const LLM_COST_PER_CALL = 0.00015;

async function runSearch(body: Record<string, unknown>, jobId: string) {
  try {
    const {
      query,
      engines,
      geo,
      num_results,
      research_mode,
      llm_expansion,
      domain_include,
      domain_exclude,
    } = body as {
      query: string;
      engines?: ("google" | "bing")[];
      geo?: string;
      num_results?: number;
      research_mode?: boolean;
      llm_expansion?: boolean;
      domain_include?: string[];
      domain_exclude?: string[];
    };

    const start = Date.now();
    let expandedQueries: string[];
    if (llm_expansion) {
      const expansionCount = research_mode ? 12 : 3;
      expandedQueries = await expandQuery(query, expansionCount);
    } else {
      expandedQueries = [query];
    }

    const rawResults = await fetchSerpFanOut(
      expandedQueries,
      engines ?? ["google"],
      geo ?? "us",
      Math.min(num_results ?? 10, 10),
    );

    const queryGroups = new Map<string, typeof rawResults>();
    for (const result of rawResults) {
      const key = `${result.source_engine}:${result.source_query}`;
      if (!queryGroups.has(key)) queryGroups.set(key, []);
      queryGroups.get(key)!.push(result);
    }

    let ranked = reciprocalRankFusion([...queryGroups.values()]);

    if (domain_include && domain_include.length > 0) {
      ranked = ranked.filter((r) =>
        domain_include.some((d) => r.domain.includes(d)),
      );
    }
    if (domain_exclude && domain_exclude.length > 0) {
      ranked = ranked.filter(
        (r) => !domain_exclude.some((d) => r.domain.includes(d)),
      );
    }

    const diverse = applyDomainDiversity(ranked);
    const clusters = clusterByDomain(diverse);
    const serpRequestCount = expandedQueries.length * (engines?.length ?? 1);
    const estimatedCost =
      serpRequestCount * SERP_COST_PER_REQUEST +
      (llm_expansion ? LLM_COST_PER_CALL : 0);

    const result = {
      query,
      expanded_queries: expandedQueries,
      results: diverse,
      clusters,
      meta: {
        total_serp_results: rawResults.length,
        unique_after_dedup: ranked.length,
        queries_executed: serpRequestCount,
        engines_used: engines ?? ["google"],
        geo: geo ?? "us",
        estimated_cost_usd: Math.round(estimatedCost * 100000) / 100000,
        duration_ms: Date.now() - start,
      },
    };

    await kvSet("search-jobs", jobId, { status: "done", result });
  } catch (err) {
    try {
      await kvSet("search-jobs", jobId, {
        status: "error",
        error: err instanceof Error ? err.message : "Search failed",
      });
    } catch {
      // ignore KV write failure in error handler
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<SearchRequest> & {
      turnstileToken?: string;
    };
    const query = body.query?.trim();
    if (!query) {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }

    // Rate limiting: 10 searches per minute per IP
    const ip = getClientIp(request);
    const rateLimit = await checkRateLimit(ip, "search", 10, 60);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please slow down." },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfter ?? 60) },
        },
      );
    }

    // Turnstile verification
    const turnstileResult = await verifyTurnstile(body.turnstileToken, ip);
    if (!turnstileResult.success) {
      return NextResponse.json(
        { error: turnstileResult.error },
        { status: 403 },
      );
    }

    const jobId = crypto.randomUUID();

    // Run search in background using Cloudflare's waitUntil
    const { ctx } = getCloudflareContext();
    ctx.waitUntil(runSearch(body as Record<string, unknown>, jobId));

    return NextResponse.json({ job_id: jobId, status: "pending" });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to start search",
      },
      { status: 500 },
    );
  }
}
