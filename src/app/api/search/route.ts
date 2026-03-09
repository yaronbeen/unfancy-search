import { NextRequest, NextResponse } from "next/server";
import { expandQuery } from "@/lib/query-expansion";
import { fetchSerpFanOut } from "@/lib/bright-data";
import { reciprocalRankFusion } from "@/lib/rerank";
import { clusterByDomain, applyDomainDiversity } from "@/lib/cluster";
import type { SearchRequest, SearchResponse, SerpResult } from "@/lib/types";

const SERP_COST_PER_REQUEST = 0.0015; // $1.50 / 1000
const LLM_COST_PER_CALL = 0.00015; // approximate gpt-4o-mini cost
const HAS_LLM = !!process.env.OPENAI_API_KEY;

export async function POST(request: NextRequest) {
  const start = Date.now();

  try {
    const body = (await request.json()) as Partial<SearchRequest>;

    const query = body.query?.trim();
    if (!query) {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }

    const engines = body.engines ?? ["google"];
    const geo = body.geo ?? "us";
    const numResults = Math.min(body.num_results ?? 10, 50);
    const researchMode = body.research_mode ?? false;
    const domainInclude = body.domain_include ?? [];
    const domainExclude = body.domain_exclude ?? [];

    // Step 1: Query expansion via LLM
    const expansionCount = researchMode ? 12 : 5;
    const expandedQueries = await expandQuery(query, expansionCount);

    // Step 2: Fan-out SERP retrieval via Bright Data
    const rawResults = await fetchSerpFanOut(
      expandedQueries,
      engines,
      geo,
      numResults,
    );

    // Step 3: Group by source query for RRF input
    const queryGroups = new Map<string, SerpResult[]>();
    for (const result of rawResults) {
      const key = `${result.source_engine}:${result.source_query}`;
      if (!queryGroups.has(key)) {
        queryGroups.set(key, []);
      }
      queryGroups.get(key)!.push(result);
    }
    const rankedLists = [...queryGroups.values()];

    // Step 4: Reciprocal Rank Fusion
    let ranked = reciprocalRankFusion(rankedLists);

    // Step 5: Apply domain filters
    if (domainInclude.length > 0) {
      ranked = ranked.filter((r) =>
        domainInclude.some((d) => r.domain.includes(d)),
      );
    }
    if (domainExclude.length > 0) {
      ranked = ranked.filter(
        (r) => !domainExclude.some((d) => r.domain.includes(d)),
      );
    }

    // Step 6: Domain diversity
    const diverse = applyDomainDiversity(ranked);

    // Step 7: Cluster for UI
    const clusters = clusterByDomain(diverse);

    // Cost calculation
    const serpRequestCount = expandedQueries.length * engines.length;
    const estimatedCost =
      serpRequestCount * SERP_COST_PER_REQUEST +
      (HAS_LLM ? LLM_COST_PER_CALL : 0);

    const response: SearchResponse = {
      query,
      expanded_queries: expandedQueries,
      results: diverse,
      clusters,
      meta: {
        total_serp_results: rawResults.length,
        unique_after_dedup: ranked.length,
        queries_executed: serpRequestCount,
        engines_used: engines,
        geo,
        estimated_cost_usd: Math.round(estimatedCost * 100000) / 100000,
        duration_ms: Date.now() - start,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Search failed" },
      { status: 500 },
    );
  }
}
