import { RankedResult, DomainCluster } from "./types";

/**
 * Groups results by domain and enforces diversity.
 *
 * Returns clusters sorted by number of results (descending),
 * and within each cluster, results are sorted by RRF score.
 */
export function clusterByDomain(results: RankedResult[]): DomainCluster[] {
  const domainMap = new Map<string, RankedResult[]>();

  for (const result of results) {
    const domain = result.domain;
    if (!domainMap.has(domain)) {
      domainMap.set(domain, []);
    }
    domainMap.get(domain)!.push(result);
  }

  const clusters: DomainCluster[] = [];

  for (const [domain, domainResults] of domainMap) {
    // Sort within cluster by RRF score
    domainResults.sort((a, b) => b.rrf_score - a.rrf_score);

    clusters.push({
      domain,
      count: domainResults.length,
      results: domainResults,
    });
  }

  // Sort clusters by result count descending
  clusters.sort((a, b) => b.count - a.count);

  return clusters;
}

/**
 * Applies domain diversity to the final result list.
 *
 * Ensures no single domain dominates the top positions.
 * Uses a round-robin approach: pick the top result from each domain,
 * then the second result from each domain, etc.
 */
export function applyDomainDiversity(
  results: RankedResult[],
  maxPerDomain: number = 3,
): RankedResult[] {
  const domainCounts = new Map<string, number>();
  const diverse: RankedResult[] = [];

  for (const result of results) {
    const count = domainCounts.get(result.domain) ?? 0;
    if (count < maxPerDomain) {
      diverse.push(result);
      domainCounts.set(result.domain, count + 1);
    }
  }

  return diverse;
}
