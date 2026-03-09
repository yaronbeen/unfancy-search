import { describe, it, expect } from "vitest";
import { reciprocalRankFusion } from "./rerank";
import type { SerpResult } from "./types";

function makeResult(
  url: string,
  query: string = "q1",
  engine: string = "google",
  position: number = 1,
): SerpResult {
  return {
    title: `Title for ${url}`,
    url,
    description: `Desc for ${url}`,
    position,
    source_engine: engine,
    source_query: query,
  };
}

describe("reciprocalRankFusion", () => {
  it("returns empty array for empty input", () => {
    expect(reciprocalRankFusion([])).toEqual([]);
  });

  it("returns empty array for empty lists", () => {
    expect(reciprocalRankFusion([[], []])).toEqual([]);
  });

  it("handles single list with single result", () => {
    const lists = [[makeResult("https://example.com", "q1")]];
    const result = reciprocalRankFusion(lists);

    expect(result).toHaveLength(1);
    expect(result[0].url).toBe("https://example.com");
    expect(result[0].rrf_score).toBeCloseTo(1 / 61, 4);
    expect(result[0].query_coverage).toBe(1);
    expect(result[0].domain).toBe("example.com");
  });

  it("boosts results appearing in multiple lists", () => {
    const lists = [
      [makeResult("https://a.com", "q1"), makeResult("https://b.com", "q1")],
      [makeResult("https://b.com", "q2"), makeResult("https://c.com", "q2")],
    ];
    const result = reciprocalRankFusion(lists);

    // b.com should be ranked highest (appears in both lists)
    expect(result[0].domain).toBe("b.com");
    expect(result[0].query_coverage).toBe(2);
  });

  it("correctly calculates RRF score for overlapping results", () => {
    const lists = [
      [makeResult("https://a.com", "q1")], // rank 0 in list 1
      [makeResult("https://a.com", "q2")], // rank 0 in list 2
    ];
    const result = reciprocalRankFusion(lists);

    // Score = 1/(60+1) + 1/(60+1) = 2/61
    expect(result[0].rrf_score).toBeCloseTo(2 / 61, 4);
    expect(result[0].query_coverage).toBe(2);
  });

  it("preserves order by score descending", () => {
    const lists = [
      [
        makeResult("https://a.com", "q1"),
        makeResult("https://b.com", "q1"),
        makeResult("https://c.com", "q1"),
      ],
    ];
    const result = reciprocalRankFusion(lists);

    expect(result[0].domain).toBe("a.com");
    expect(result[1].domain).toBe("b.com");
    expect(result[2].domain).toBe("c.com");
    expect(result[0].rrf_score).toBeGreaterThan(result[1].rrf_score);
    expect(result[1].rrf_score).toBeGreaterThan(result[2].rrf_score);
  });

  it("deduplicates by canonical URL", () => {
    const lists = [
      [makeResult("https://www.example.com/page", "q1")],
      [makeResult("https://example.com/page", "q2")],
    ];
    const result = reciprocalRankFusion(lists);

    // Should be deduped to a single result
    expect(result).toHaveLength(1);
    expect(result[0].query_coverage).toBe(2);
  });

  it("deduplicates URLs with tracking params vs clean", () => {
    const lists = [
      [makeResult("https://example.com/page?utm_source=google", "q1")],
      [makeResult("https://example.com/page", "q2")],
    ];
    const result = reciprocalRankFusion(lists);

    expect(result).toHaveLength(1);
    expect(result[0].query_coverage).toBe(2);
  });

  it("handles no overlap between lists", () => {
    const lists = [
      [makeResult("https://a.com", "q1")],
      [makeResult("https://b.com", "q2")],
      [makeResult("https://c.com", "q3")],
    ];
    const result = reciprocalRankFusion(lists);

    expect(result).toHaveLength(3);
    // All should have equal RRF score (rank 0 in their respective lists)
    expect(result[0].rrf_score).toBe(result[1].rrf_score);
    // All should have query_coverage of 1
    result.forEach((r) => expect(r.query_coverage).toBe(1));
  });

  it("respects custom k value", () => {
    const lists = [[makeResult("https://a.com", "q1")]];
    const result = reciprocalRankFusion(lists, 10);

    // Score with k=10: 1/(10+1) = 1/11
    expect(result[0].rrf_score).toBeCloseTo(1 / 11, 4);
  });

  it("keeps first occurrence metadata when deduplicating", () => {
    const lists = [
      [
        {
          ...makeResult("https://example.com", "q1"),
          title: "First Title",
        },
      ],
      [
        {
          ...makeResult("https://example.com", "q2"),
          title: "Second Title",
        },
      ],
    ];
    const result = reciprocalRankFusion(lists);

    expect(result[0].title).toBe("First Title");
  });

  it("handles many results across many lists", () => {
    const lists = Array.from({ length: 5 }, (_, i) =>
      Array.from({ length: 10 }, (_, j) =>
        makeResult(`https://site${j}.com`, `q${i}`),
      ),
    );
    const result = reciprocalRankFusion(lists);

    expect(result).toHaveLength(10);
    // Each result should appear in all 5 lists
    result.forEach((r) => expect(r.query_coverage).toBe(5));
  });
});
