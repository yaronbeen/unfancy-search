import { SerpResult, RankedResult } from "./types";
import { canonicalizeUrl, extractDomain } from "./dedupe";

/**
 * Reciprocal Rank Fusion (RRF)
 *
 * Merges multiple ranked lists into a single ranking.
 * Results that appear across more sub-queries get boosted.
 *
 * Formula: RRF_score(doc) = SUM( 1 / (k + rank) ) for each list containing doc
 *
 * k=60 is standard (from the original Cormack et al. paper).
 */
export function reciprocalRankFusion(
  rankedLists: SerpResult[][],
  k: number = 60,
): RankedResult[] {
  const scores = new Map<string, number>();
  const coverage = new Map<string, Set<string>>();
  const items = new Map<string, SerpResult>();

  for (const list of rankedLists) {
    for (let rank = 0; rank < list.length; rank++) {
      const canonical = canonicalizeUrl(list[rank].url);

      // Accumulate RRF score
      scores.set(canonical, (scores.get(canonical) ?? 0) + 1 / (k + rank + 1));

      // Track which queries returned this URL
      if (!coverage.has(canonical)) {
        coverage.set(canonical, new Set());
      }
      coverage.get(canonical)!.add(list[rank].source_query);

      // Keep the first occurrence (highest-ranked version)
      if (!items.has(canonical)) {
        items.set(canonical, list[rank]);
      }
    }
  }

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([canonical, score]) => {
      const item = items.get(canonical)!;
      const queryCoverage = coverage.get(canonical)?.size ?? 0;

      return {
        ...item,
        rrf_score: Math.round(score * 10000) / 10000,
        query_coverage: queryCoverage,
        domain: extractDomain(item.url),
      };
    });
}
