import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock global fetch for fire-and-forget background call
const mockFetch = vi.fn().mockResolvedValue(new Response("ok"));
vi.stubGlobal("fetch", mockFetch);

import { POST } from "./route";

function makeRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost:3000/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/search (dispatcher)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue(new Response("ok"));
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

  it("returns job_id and pending status for valid query", async () => {
    const req = makeRequest({ query: "typescript" });
    const res = await POST(req as any);

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.job_id).toBeDefined();
    expect(typeof body.job_id).toBe("string");
    expect(body.job_id.length).toBeGreaterThan(0);
    expect(body.status).toBe("pending");
  });

  it("fires background function with job_id and query params", async () => {
    const req = makeRequest({
      query: "test",
      engines: ["google", "bing"],
      geo: "uk",
    });
    await POST(req as any);

    // fetch is called once for the background function fire-and-forget
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain("/.netlify/functions/search-bg");
    expect(options.method).toBe("POST");

    const sentBody = JSON.parse(options.body);
    expect(sentBody.query).toBe("test");
    expect(sentBody.engines).toEqual(["google", "bing"]);
    expect(sentBody.geo).toBe("uk");
    expect(sentBody.job_id).toBeDefined();
  });

  it("returns unique job_ids for concurrent requests", async () => {
    const req1 = makeRequest({ query: "test1" });
    const req2 = makeRequest({ query: "test2" });

    const [res1, res2] = await Promise.all([
      POST(req1 as any),
      POST(req2 as any),
    ]);

    const body1 = await res1.json();
    const body2 = await res2.json();

    expect(body1.job_id).not.toBe(body2.job_id);
  });

  it("still returns 200 even if background fetch fails", async () => {
    mockFetch.mockRejectedValue(new Error("network error"));

    const req = makeRequest({ query: "test" });
    const res = await POST(req as any);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.job_id).toBeDefined();
    expect(body.status).toBe("pending");
  });

  it("returns 500 when request body is invalid JSON", async () => {
    const req = new Request("http://localhost:3000/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await POST(req as any);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});
