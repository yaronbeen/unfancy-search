import { describe, it, expect } from "vitest";
import { clusterByDomain, applyDomainDiversity } from "./cluster";
import type { RankedResult } from "./types";

function makeRanked(
  domain: string,
  rrfScore: number,
  url?: string,
): RankedResult {
  return {
    title: `Result from ${domain}`,
    url: url ?? `https://${domain}/page`,
    description: `Description for ${domain}`,
    position: 1,
    source_engine: "google",
    source_query: "test",
    rrf_score: rrfScore,
    query_coverage: 1,
    domain,
  };
}

describe("clusterByDomain", () => {
  it("returns empty array for empty input", () => {
    expect(clusterByDomain([])).toEqual([]);
  });

  it("groups results by domain", () => {
    const results = [
      makeRanked("a.com", 0.5),
      makeRanked("b.com", 0.4),
      makeRanked("a.com", 0.3),
    ];
    const clusters = clusterByDomain(results);

    expect(clusters).toHaveLength(2);
    const aDomain = clusters.find((c) => c.domain === "a.com");
    expect(aDomain?.count).toBe(2);
    expect(aDomain?.results).toHaveLength(2);
  });

  it("sorts clusters by count descending", () => {
    const results = [
      makeRanked("a.com", 0.5),
      makeRanked("a.com", 0.4),
      makeRanked("a.com", 0.3),
      makeRanked("b.com", 0.6),
      makeRanked("b.com", 0.2),
      makeRanked("c.com", 0.1),
    ];
    const clusters = clusterByDomain(results);

    expect(clusters[0].domain).toBe("a.com");
    expect(clusters[0].count).toBe(3);
    expect(clusters[1].domain).toBe("b.com");
    expect(clusters[1].count).toBe(2);
    expect(clusters[2].domain).toBe("c.com");
    expect(clusters[2].count).toBe(1);
  });

  it("sorts results within each cluster by RRF score descending", () => {
    const results = [
      makeRanked("a.com", 0.1, "https://a.com/low"),
      makeRanked("a.com", 0.9, "https://a.com/high"),
      makeRanked("a.com", 0.5, "https://a.com/mid"),
    ];
    const clusters = clusterByDomain(results);
    const aCluster = clusters[0];

    expect(aCluster.results[0].rrf_score).toBe(0.9);
    expect(aCluster.results[1].rrf_score).toBe(0.5);
    expect(aCluster.results[2].rrf_score).toBe(0.1);
  });

  it("handles single domain", () => {
    const results = [makeRanked("only.com", 0.5)];
    const clusters = clusterByDomain(results);

    expect(clusters).toHaveLength(1);
    expect(clusters[0].domain).toBe("only.com");
    expect(clusters[0].count).toBe(1);
  });

  it("handles many unique domains", () => {
    const results = Array.from({ length: 10 }, (_, i) =>
      makeRanked(`site${i}.com`, 0.5 - i * 0.01),
    );
    const clusters = clusterByDomain(results);

    expect(clusters).toHaveLength(10);
    clusters.forEach((c) => expect(c.count).toBe(1));
  });
});

describe("applyDomainDiversity", () => {
  it("returns empty array for empty input", () => {
    expect(applyDomainDiversity([])).toEqual([]);
  });

  it("limits results per domain to default max of 3", () => {
    const results = [
      makeRanked("a.com", 0.9, "https://a.com/1"),
      makeRanked("a.com", 0.8, "https://a.com/2"),
      makeRanked("a.com", 0.7, "https://a.com/3"),
      makeRanked("a.com", 0.6, "https://a.com/4"),
      makeRanked("a.com", 0.5, "https://a.com/5"),
    ];
    const diverse = applyDomainDiversity(results);

    expect(diverse).toHaveLength(3);
  });

  it("preserves input order", () => {
    const results = [
      makeRanked("a.com", 0.9),
      makeRanked("b.com", 0.8),
      makeRanked("a.com", 0.7, "https://a.com/2"),
      makeRanked("b.com", 0.6, "https://b.com/2"),
    ];
    const diverse = applyDomainDiversity(results);

    expect(diverse).toHaveLength(4);
    expect(diverse[0].domain).toBe("a.com");
    expect(diverse[1].domain).toBe("b.com");
    expect(diverse[2].domain).toBe("a.com");
    expect(diverse[3].domain).toBe("b.com");
  });

  it("respects custom maxPerDomain", () => {
    const results = [
      makeRanked("a.com", 0.9),
      makeRanked("a.com", 0.8, "https://a.com/2"),
      makeRanked("a.com", 0.7, "https://a.com/3"),
    ];
    const diverse = applyDomainDiversity(results, 1);

    expect(diverse).toHaveLength(1);
    expect(diverse[0].rrf_score).toBe(0.9);
  });

  it("does not filter when all domains are unique", () => {
    const results = [
      makeRanked("a.com", 0.9),
      makeRanked("b.com", 0.8),
      makeRanked("c.com", 0.7),
      makeRanked("d.com", 0.6),
    ];
    const diverse = applyDomainDiversity(results);

    expect(diverse).toHaveLength(4);
  });

  it("handles mixed domain counts correctly", () => {
    const results = [
      makeRanked("a.com", 0.9),
      makeRanked("a.com", 0.85, "https://a.com/2"),
      makeRanked("b.com", 0.8),
      makeRanked("a.com", 0.75, "https://a.com/3"),
      makeRanked("a.com", 0.7, "https://a.com/4"), // should be filtered
      makeRanked("b.com", 0.65, "https://b.com/2"),
    ];
    const diverse = applyDomainDiversity(results);

    expect(diverse).toHaveLength(5); // 3 from a.com + 2 from b.com
    const aDomainResults = diverse.filter((r) => r.domain === "a.com");
    expect(aDomainResults).toHaveLength(3);
  });

  it("with maxPerDomain=0 returns nothing", () => {
    const results = [makeRanked("a.com", 0.9)];
    const diverse = applyDomainDiversity(results, 0);

    expect(diverse).toHaveLength(0);
  });
});
