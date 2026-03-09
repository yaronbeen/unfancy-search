import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SerpResult, RankedResult } from "@/lib/types";

// Mock the lib modules
vi.mock("@/lib/query-expansion", () => ({
  expandQuery: vi.fn(),
}));

vi.mock("@/lib/bright-data", () => ({
  fetchSerpFanOut: vi.fn(),
}));

vi.mock("@/lib/rerank", () => ({
  reciprocalRankFusion: vi.fn(),
}));

vi.mock("@/lib/cluster", () => ({
  clusterByDomain: vi.fn(),
  applyDomainDiversity: vi.fn(),
}));

import { POST } from "./route";
import { expandQuery } from "@/lib/query-expansion";
import { fetchSerpFanOut } from "@/lib/bright-data";
import { reciprocalRankFusion } from "@/lib/rerank";
import { clusterByDomain, applyDomainDiversity } from "@/lib/cluster";

function makeRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost:3000/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeSerpResult(url: string, query: string): SerpResult {
  return {
    title: `Title ${url}`,
    url,
    description: `Desc ${url}`,
    position: 1,
    source_engine: "google",
    source_query: query,
  };
}

function makeRankedResult(
  url: string,
  domain: string,
  score: number = 0.5,
): RankedResult {
  return {
    title: `Title ${url}`,
    url,
    description: `Desc ${url}`,
    position: 1,
    source_engine: "google",
    source_query: "test",
    rrf_score: score,
    query_coverage: 1,
    domain,
  };
}

describe("POST /api/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    vi.mocked(expandQuery).mockResolvedValue(["test query", "test expanded"]);
    vi.mocked(fetchSerpFanOut).mockResolvedValue([
      makeSerpResult("https://a.com", "test query"),
      makeSerpResult("https://b.com", "test expanded"),
    ]);
    vi.mocked(reciprocalRankFusion).mockReturnValue([
      makeRankedResult("https://a.com", "a.com", 0.5),
      makeRankedResult("https://b.com", "b.com", 0.4),
    ]);
    vi.mocked(applyDomainDiversity).mockImplementation((results) => results);
    vi.mocked(clusterByDomain).mockReturnValue([
      {
        domain: "a.com",
        count: 1,
        results: [makeRankedResult("https://a.com", "a.com")],
      },
    ]);
  });

  it("returns 400 when query is missing", async () => {
    const req = makeRequest({});
    const res = await POST(req as any);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("query is required");
  });

  it("returns 400 when query is empty string", async () => {
    const req = makeRequest({ query: "   " });
    const res = await POST(req as any);

    expect(res.status).toBe(400);
  });

  it("executes full pipeline successfully", async () => {
    const req = makeRequest({ query: "typescript" });
    const res = await POST(req as any);

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.query).toBe("typescript");
    expect(body.expanded_queries).toEqual(["test query", "test expanded"]);
    expect(body.results).toHaveLength(2);
    expect(body.clusters).toBeDefined();
    expect(body.meta).toBeDefined();
    expect(body.meta.queries_executed).toBeGreaterThan(0);
  });

  it("uses default parameters when not provided", async () => {
    const req = makeRequest({ query: "test" });
    await POST(req as any);

    expect(expandQuery).toHaveBeenCalledWith("test", 5); // default, not research mode
    expect(fetchSerpFanOut).toHaveBeenCalledWith(
      expect.any(Array),
      ["google"], // default engine
      "us", // default geo
      10, // default num_results
    );
  });

  it("respects research mode (12 sub-queries)", async () => {
    const req = makeRequest({ query: "test", research_mode: true });
    await POST(req as any);

    expect(expandQuery).toHaveBeenCalledWith("test", 12);
  });

  it("respects custom engines and geo", async () => {
    const req = makeRequest({
      query: "test",
      engines: ["google", "bing"],
      geo: "uk",
      num_results: 20,
    });
    await POST(req as any);

    expect(fetchSerpFanOut).toHaveBeenCalledWith(
      expect.any(Array),
      ["google", "bing"],
      "uk",
      20,
    );
  });

  it("caps num_results at 50", async () => {
    const req = makeRequest({ query: "test", num_results: 100 });
    await POST(req as any);

    expect(fetchSerpFanOut).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Array),
      expect.any(String),
      50,
    );
  });

  it("applies domain_include filter", async () => {
    vi.mocked(reciprocalRankFusion).mockReturnValue([
      makeRankedResult("https://a.com/page", "a.com", 0.5),
      makeRankedResult("https://b.com/page", "b.com", 0.4),
      makeRankedResult("https://c.com/page", "c.com", 0.3),
    ]);

    const req = makeRequest({
      query: "test",
      domain_include: ["a.com"],
    });
    const res = await POST(req as any);
    const body = await res.json();

    // applyDomainDiversity receives already-filtered results
    expect(vi.mocked(applyDomainDiversity)).toHaveBeenCalled();
    const callArgs = vi.mocked(applyDomainDiversity).mock.calls[0][0];
    expect(
      callArgs.every((r: RankedResult) => r.domain.includes("a.com")),
    ).toBe(true);
  });

  it("applies domain_exclude filter", async () => {
    vi.mocked(reciprocalRankFusion).mockReturnValue([
      makeRankedResult("https://a.com/page", "a.com", 0.5),
      makeRankedResult("https://b.com/page", "b.com", 0.4),
    ]);

    const req = makeRequest({
      query: "test",
      domain_exclude: ["a.com"],
    });
    const res = await POST(req as any);

    const callArgs = vi.mocked(applyDomainDiversity).mock.calls[0][0];
    expect(
      callArgs.every((r: RankedResult) => !r.domain.includes("a.com")),
    ).toBe(true);
  });

  it("includes cost metadata", async () => {
    const req = makeRequest({ query: "test" });
    const res = await POST(req as any);
    const body = await res.json();

    expect(body.meta.estimated_cost_usd).toBeGreaterThan(0);
    expect(body.meta.duration_ms).toBeGreaterThanOrEqual(0);
    expect(body.meta.engines_used).toEqual(["google"]);
    expect(body.meta.geo).toBe("us");
  });

  it("returns 500 on internal error", async () => {
    vi.mocked(expandQuery).mockRejectedValue(new Error("LLM exploded"));

    const req = makeRequest({ query: "test" });
    const res = await POST(req as any);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("LLM exploded");
  });

  it("handles non-Error throws", async () => {
    vi.mocked(expandQuery).mockRejectedValue("string error");

    const req = makeRequest({ query: "test" });
    const res = await POST(req as any);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Search failed");
  });
});
