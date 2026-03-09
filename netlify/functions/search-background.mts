import type { Context } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { expandQuery } from "../../src/lib/query-expansion.js";
import { fetchSerpFanOut } from "../../src/lib/bright-data.js";
import { reciprocalRankFusion } from "../../src/lib/rerank.js";
import { clusterByDomain, applyDomainDiversity } from "../../src/lib/cluster.js";

const SERP_COST_PER_REQUEST = 0.0015;
const LLM_COST_PER_CALL = 0.00015;

function getJobStore() {
  const siteID = process.env.NETLIFY_SITE_ID ?? "f566d9dd-b740-4ecf-afcd-2e962bda6e7a";
  const token = process.env.NETLIFY_TOKEN;
  if (token) {
    return getStore({ name: "search-jobs", siteID, token });
  }
  // fallback: rely on auto-injected context (works in regular functions)
  return getStore("search-jobs");
}

export default async (req: Request, context: Context) => {
  let jobId: string | undefined;

  try {
    const body = await req.json();
    jobId = body.job_id;
    const { query, engines, geo, num_results, research_mode, llm_expansion, domain_include, domain_exclude } = body;

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

    const queryGroups = new Map();
    for (const result of rawResults) {
      const key = `${result.source_engine}:${result.source_query}`;
      if (!queryGroups.has(key)) queryGroups.set(key, []);
      queryGroups.get(key).push(result);
    }

    let ranked = reciprocalRankFusion([...queryGroups.values()]);

    if (domain_include?.length > 0) {
      ranked = ranked.filter((r: any) => domain_include.some((d: string) => r.domain.includes(d)));
    }
    if (domain_exclude?.length > 0) {
      ranked = ranked.filter((r: any) => !domain_exclude.some((d: string) => r.domain.includes(d)));
    }

    const diverse = applyDomainDiversity(ranked);
    const clusters = clusterByDomain(diverse);
    const serpRequestCount = expandedQueries.length * (engines?.length ?? 1);
    const estimatedCost = serpRequestCount * SERP_COST_PER_REQUEST + (llm_expansion ? LLM_COST_PER_CALL : 0);

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

    const store = getJobStore();
    await store.setJSON(jobId!, { status: "done", result });
  } catch (err) {
    if (jobId) {
      try {
        const store = getJobStore();
        await store.setJSON(jobId, {
          status: "error",
          error: err instanceof Error ? err.message : "Search failed",
        });
      } catch {
        // ignore blob write failure in error handler
      }
    }
  }
};
