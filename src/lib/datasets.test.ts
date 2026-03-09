import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  triggerBaseline,
  checkBaselineProgress,
  fetchBaselineSnapshot,
  compareBaseline,
} from "./datasets";
import type { RankedResult, BaselineSnapshot } from "./types";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("BRIGHT_DATA_API_TOKEN", "test-token");
  vi.stubEnv("BRIGHT_DATA_DATASET_ID", "gd_test123");
});

describe("triggerBaseline", () => {
  it("sends correct request to Datasets API trigger endpoint", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ snapshot_id: "s_abc123" }),
    });

    const result = await triggerBaseline(["best laptops 2024"], "google", "us");

    expect(result.snapshot_id).toBe("s_abc123");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.brightdata.com/datasets/v3/trigger?dataset_id=gd_test123",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
          "Content-Type": "application/json",
        }),
      }),
    );

    // Verify the body contains search URLs
    const call = mockFetch.mock.calls[0];
    const body = JSON.parse(call[1].body);
    expect(body).toHaveLength(1);
    expect(body[0].url).toContain("google.com/search");
    expect(body[0].url).toContain("best%20laptops%202024");
  });

  it("builds Bing URLs when engine is bing", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ snapshot_id: "s_bing1" }),
    });

    await triggerBaseline(["test query"], "bing", "uk");

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body[0].url).toContain("bing.com/search");
    expect(body[0].url).toContain("cc=uk");
  });

  it("handles multiple queries", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ snapshot_id: "s_multi" }),
    });

    await triggerBaseline(["query 1", "query 2", "query 3"]);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toHaveLength(3);
  });

  it("throws when API token is missing", async () => {
    vi.stubEnv("BRIGHT_DATA_API_TOKEN", "");

    await expect(triggerBaseline(["test"])).rejects.toThrow(
      "BRIGHT_DATA_API_TOKEN is not set",
    );
  });

  it("throws when dataset ID is missing", async () => {
    vi.stubEnv("BRIGHT_DATA_DATASET_ID", "");

    await expect(triggerBaseline(["test"])).rejects.toThrow(
      "BRIGHT_DATA_DATASET_ID is not set",
    );
  });

  it("throws on API error response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => "Forbidden",
    });

    await expect(triggerBaseline(["test"])).rejects.toThrow(
      "Datasets API trigger error 403: Forbidden",
    );
  });
});

describe("checkBaselineProgress", () => {
  it("fetches snapshot progress", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "running", progress: 45 }),
    });

    const result = await checkBaselineProgress("s_abc123");

    expect(result.status).toBe("running");
    expect(result.progress).toBe(45);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.brightdata.com/datasets/v3/progress/s_abc123",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
        }),
      }),
    );
  });

  it("throws on error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => "Snapshot not found",
    });

    await expect(checkBaselineProgress("s_bad")).rejects.toThrow(
      "Datasets API progress error 404",
    );
  });
});

describe("fetchBaselineSnapshot", () => {
  it("transforms Datasets API response into BaselineSnapshot", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          general: { query: "best laptops" },
          timestamp: "2024-01-15T10:00:00Z",
          organic: [
            {
              link: "https://www.example.com/laptops",
              title: "Best Laptops 2024",
              description: "Top picks for laptops",
              rank: 1,
            },
            {
              link: "https://techsite.com/review",
              title: "Laptop Reviews",
              description: "In-depth reviews",
              rank: 2,
            },
          ],
        },
      ],
    });

    const snapshot = await fetchBaselineSnapshot("s_abc123");

    expect(snapshot.snapshot_id).toBe("s_abc123");
    expect(snapshot.query).toBe("best laptops");
    expect(snapshot.status).toBe("ready");
    expect(snapshot.results).toHaveLength(2);
    expect(snapshot.results[0].domain).toBe("example.com");
    expect(snapshot.results[1].url).toBe("https://techsite.com/review");
  });

  it("handles empty organic results", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ general: { query: "niche query" }, organic: [] }],
    });

    const snapshot = await fetchBaselineSnapshot("s_empty");
    expect(snapshot.results).toHaveLength(0);
  });

  it("handles alternative response format with results array", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          input: { keyword: "test query" },
          results: [
            {
              url: "https://alt.com/page",
              title: "Alt Result",
              snippet: "Description",
            },
          ],
        },
      ],
    });

    const snapshot = await fetchBaselineSnapshot("s_alt");
    expect(snapshot.results).toHaveLength(1);
    expect(snapshot.results[0].url).toBe("https://alt.com/page");
    expect(snapshot.results[0].description).toBe("Description");
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => "Not found",
    });

    await expect(fetchBaselineSnapshot("s_bad")).rejects.toThrow(
      "Datasets API snapshot error 404",
    );
  });
});

describe("compareBaseline", () => {
  const baseline: BaselineSnapshot = {
    snapshot_id: "s_test",
    query: "test query",
    collected_at: "2024-01-15T10:00:00Z",
    status: "ready",
    results: [
      {
        title: "Result A",
        url: "https://example.com/a",
        description: "Description A",
        domain: "example.com",
      },
      {
        title: "Result B",
        url: "https://other.com/b",
        description: "Description B",
        domain: "other.com",
      },
      {
        title: "Result C",
        url: "https://gone.com/c",
        description: "Description C",
        domain: "gone.com",
      },
    ],
  };

  const liveResults: RankedResult[] = [
    {
      title: "Result A",
      url: "https://example.com/a",
      description: "Description A",
      position: 1,
      source_engine: "google",
      source_query: "test",
      rrf_score: 0.5,
      query_coverage: 3,
      domain: "example.com",
    },
    {
      title: "Result B",
      url: "https://other.com/b",
      description: "Description B",
      position: 2,
      source_engine: "google",
      source_query: "test",
      rrf_score: 0.4,
      query_coverage: 2,
      domain: "other.com",
    },
    {
      title: "New Result",
      url: "https://new-site.com/page",
      description: "New Description",
      position: 3,
      source_engine: "google",
      source_query: "test",
      rrf_score: 0.3,
      query_coverage: 1,
      domain: "new-site.com",
    },
  ];

  it("identifies new sources (in live but not baseline)", () => {
    const diff = compareBaseline(liveResults, baseline);
    expect(diff.new_sources).toHaveLength(1);
    expect(diff.new_sources[0].domain).toBe("new-site.com");
  });

  it("identifies missing sources (in baseline but not live)", () => {
    const diff = compareBaseline(liveResults, baseline);
    expect(diff.missing_sources).toHaveLength(1);
    expect(diff.missing_sources[0].domain).toBe("gone.com");
  });

  it("identifies persistent sources (in both)", () => {
    const diff = compareBaseline(liveResults, baseline);
    expect(diff.persistent_sources).toHaveLength(2);
  });

  it("reports correct totals", () => {
    const diff = compareBaseline(liveResults, baseline);
    expect(diff.baseline_total).toBe(3);
    expect(diff.live_total).toBe(3);
    expect(diff.snapshot_id).toBe("s_test");
    expect(diff.collected_at).toBe("2024-01-15T10:00:00Z");
  });

  it("handles empty baseline", () => {
    const emptyBaseline: BaselineSnapshot = {
      ...baseline,
      results: [],
    };
    const diff = compareBaseline(liveResults, emptyBaseline);
    expect(diff.new_sources).toHaveLength(3);
    expect(diff.missing_sources).toHaveLength(0);
    expect(diff.persistent_sources).toHaveLength(0);
  });

  it("handles empty live results", () => {
    const diff = compareBaseline([], baseline);
    expect(diff.new_sources).toHaveLength(0);
    expect(diff.missing_sources).toHaveLength(3);
    expect(diff.persistent_sources).toHaveLength(0);
  });

  it("uses canonical URL matching (strips www, trailing slash, etc.)", () => {
    const baselineWithWww: BaselineSnapshot = {
      ...baseline,
      results: [
        {
          title: "Result",
          url: "https://www.example.com/page/",
          description: "Desc",
          domain: "example.com",
        },
      ],
    };
    const liveWithoutWww: RankedResult[] = [
      {
        title: "Result",
        url: "https://example.com/page",
        description: "Desc",
        position: 1,
        source_engine: "google",
        source_query: "test",
        rrf_score: 0.5,
        query_coverage: 1,
        domain: "example.com",
      },
    ];

    const diff = compareBaseline(liveWithoutWww, baselineWithWww);
    // Should match as same URL after canonicalization
    expect(diff.persistent_sources).toHaveLength(1);
    expect(diff.new_sources).toHaveLength(0);
    expect(diff.missing_sources).toHaveLength(0);
  });
});
