import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @opennextjs/cloudflare — provides ctx.waitUntil and KV bindings
const mockWaitUntil = vi.fn();
const mockKvPut = vi.fn().mockResolvedValue(undefined);
const mockKvGet = vi.fn().mockResolvedValue(null);

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => ({
    env: {
      SEARCH_JOBS_KV: {
        put: mockKvPut,
        get: mockKvGet,
      },
      BASELINE_JOBS_KV: {
        put: vi.fn(),
        get: vi.fn(),
      },
      BASELINES_KV: {
        put: vi.fn(),
        get: vi.fn(),
      },
    },
    ctx: {
      waitUntil: mockWaitUntil,
    },
    cf: {},
  }),
}));

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
    const body = (await res.json()) as { job_id: string; status: string };

    expect(body.job_id).toBeDefined();
    expect(typeof body.job_id).toBe("string");
    expect(body.job_id.length).toBeGreaterThan(0);
    expect(body.status).toBe("pending");
  });

  it("calls ctx.waitUntil with the background search promise", async () => {
    const req = makeRequest({
      query: "test",
      engines: ["google"],
      geo: "uk",
    });
    await POST(req as any);

    // waitUntil should be called once with a Promise
    expect(mockWaitUntil).toHaveBeenCalledTimes(1);
    expect(mockWaitUntil.mock.calls[0][0]).toBeInstanceOf(Promise);
  });

  it("returns unique job_ids for concurrent requests", async () => {
    const req1 = makeRequest({ query: "test1" });
    const req2 = makeRequest({ query: "test2" });

    const [res1, res2] = await Promise.all([
      POST(req1 as any),
      POST(req2 as any),
    ]);

    const body1 = (await res1.json()) as { job_id: string };
    const body2 = (await res2.json()) as { job_id: string };

    expect(body1.job_id).not.toBe(body2.job_id);
  });

  it("still returns 200 — waitUntil handles background errors", async () => {
    // Even if the background function would fail, POST returns immediately
    const req = makeRequest({ query: "test" });
    const res = await POST(req as any);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { job_id: string; status: string };
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
    const body = (await res.json()) as { error: string };
    expect(body.error).toBeDefined();
  });
});
