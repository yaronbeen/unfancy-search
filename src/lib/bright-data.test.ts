import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchSerp, fetchSerpFanOut } from "./bright-data";

describe("fetchSerp", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.BRIGHT_DATA_API_TOKEN = "test-token";
    process.env.BRIGHT_DATA_SERP_ZONE = "test-zone";
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("throws when BRIGHT_DATA_API_TOKEN is not set", async () => {
    delete process.env.BRIGHT_DATA_API_TOKEN;

    await expect(
      fetchSerp({ query: "test", search_engine: "google" }),
    ).rejects.toThrow("BRIGHT_DATA_API_TOKEN is not set");
  });

  it("makes correct API call with Google engine", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        organic: [
          {
            title: "Test Result",
            link: "https://example.com",
            description: "Test description",
            rank: 1,
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await fetchSerp({
      query: "typescript",
      search_engine: "google",
      country: "us",
      num_results: 10,
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.brightdata.com/request");
    expect(options.method).toBe("POST");

    const body = JSON.parse(options.body);
    expect(body.zone).toBe("test-zone");
    expect(body.url).toContain("google.com/search");
    expect(body.url).toContain("q=typescript");
  });

  it("constructs Bing URL correctly", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ organic: [] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await fetchSerp({
      query: "test",
      search_engine: "bing",
      country: "uk",
      num_results: 5,
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.url).toContain("bing.com/search");
    expect(body.url).toContain("q=test");
    expect(body.url).toContain("count=5");
    expect(body.url).toContain("cc=uk");
  });

  it("transforms organic results to SerpResult format", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        organic: [
          {
            title: "Title 1",
            link: "https://example.com/1",
            description: "Desc 1",
            rank: 1,
          },
          {
            title: "Title 2",
            link: "https://example.com/2",
            description: "Desc 2",
            rank: 2,
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const results = await fetchSerp({
      query: "test",
      search_engine: "google",
    });

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({
      title: "Title 1",
      url: "https://example.com/1",
      description: "Desc 1",
      position: 1,
      source_engine: "google",
      source_query: "test",
    });
  });

  it("returns empty array when no organic results", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", mockFetch);

    const results = await fetchSerp({
      query: "test",
      search_engine: "google",
    });

    expect(results).toEqual([]);
  });

  it("handles missing fields gracefully", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        organic: [{ link: "https://example.com" }],
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const results = await fetchSerp({
      query: "test",
      search_engine: "google",
    });

    expect(results[0].title).toBe("");
    expect(results[0].description).toBe("");
  });

  it("throws on API error response", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => "Forbidden",
    });
    vi.stubGlobal("fetch", mockFetch);

    await expect(
      fetchSerp({ query: "test", search_engine: "google" }),
    ).rejects.toThrow("SERP API error 403: Forbidden");
  });

  it("uses default zone when not set", async () => {
    delete process.env.BRIGHT_DATA_SERP_ZONE;

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ organic: [] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await fetchSerp({ query: "test", search_engine: "google" });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.zone).toBe("serp_api1");
  });
});

describe("fetchSerpFanOut", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.BRIGHT_DATA_API_TOKEN = "test-token";
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("runs queries across all engines in parallel", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        organic: [
          {
            title: "Result",
            link: "https://example.com",
            description: "Desc",
            rank: 1,
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const results = await fetchSerpFanOut(
      ["query1", "query2"],
      ["google", "bing"],
      "us",
      10,
    );

    // 2 queries x 2 engines = 4 requests
    expect(mockFetch).toHaveBeenCalledTimes(4);
    expect(results).toHaveLength(4);
  });

  it("collects results from successful requests and ignores failures", async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 2) {
        return { ok: false, status: 500, text: async () => "Server Error" };
      }
      return {
        ok: true,
        json: async () => ({
          organic: [
            {
              title: "Result",
              link: "https://example.com",
              description: "Desc",
              rank: 1,
            },
          ],
        }),
      };
    });
    vi.stubGlobal("fetch", mockFetch);

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const results = await fetchSerpFanOut(["q1", "q2"], ["google"], "us", 10);

    // 1 out of 2 should succeed
    expect(results).toHaveLength(1);
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("returns empty array when all requests fail", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "Error",
    });
    vi.stubGlobal("fetch", mockFetch);

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const results = await fetchSerpFanOut(["q1"], ["google"], "us", 10);

    expect(results).toEqual([]);
    consoleSpy.mockRestore();
  });
});
