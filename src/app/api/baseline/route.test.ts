import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { NextRequest } from "next/server";

// Mock the datasets module
vi.mock("@/lib/datasets", () => ({
  triggerBaseline: vi.fn(),
  checkBaselineProgress: vi.fn(),
  fetchBaselineSnapshot: vi.fn(),
  compareBaseline: vi.fn(),
}));

import {
  triggerBaseline,
  checkBaselineProgress,
  fetchBaselineSnapshot,
  compareBaseline,
} from "@/lib/datasets";

const mockedTrigger = vi.mocked(triggerBaseline);
const mockedProgress = vi.mocked(checkBaselineProgress);
const mockedFetchSnapshot = vi.mocked(fetchBaselineSnapshot);
const mockedCompare = vi.mocked(compareBaseline);

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/baseline", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/baseline", () => {
  it("returns 400 when action is missing", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("action is required");
  });

  describe("action: trigger", () => {
    it("triggers a baseline collection and returns snapshot_id", async () => {
      mockedTrigger.mockResolvedValueOnce({ snapshot_id: "s_new123" });

      const res = await POST(
        makeRequest({
          action: "trigger",
          queries: ["test query 1", "test query 2"],
          engine: "google",
          geo: "us",
        }),
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.snapshot_id).toBe("s_new123");
      expect(data.status).toBe("collecting");
      expect(data.message).toContain("daily or weekly");

      expect(mockedTrigger).toHaveBeenCalledWith(
        ["test query 1", "test query 2"],
        "google",
        "us",
      );
    });

    it("returns 400 when queries are empty", async () => {
      const res = await POST(makeRequest({ action: "trigger", queries: [] }));
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("queries");
    });

    it("returns 400 when queries are missing", async () => {
      const res = await POST(makeRequest({ action: "trigger" }));
      expect(res.status).toBe(400);
    });

    it("uses default engine and geo", async () => {
      mockedTrigger.mockResolvedValueOnce({ snapshot_id: "s_defaults" });

      await POST(makeRequest({ action: "trigger", queries: ["test"] }));

      expect(mockedTrigger).toHaveBeenCalledWith(["test"], "google", "us");
    });
  });

  describe("action: status", () => {
    it("returns snapshot progress", async () => {
      mockedProgress.mockResolvedValueOnce({
        status: "running",
        progress: 60,
      });

      const res = await POST(
        makeRequest({ action: "status", snapshot_id: "s_abc" }),
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe("running");
      expect(data.progress).toBe(60);
    });

    it("returns 400 when snapshot_id is missing", async () => {
      const res = await POST(makeRequest({ action: "status" }));
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("snapshot_id");
    });
  });

  describe("action: compare", () => {
    it("fetches baseline and returns diff", async () => {
      const mockSnapshot = {
        snapshot_id: "s_old",
        query: "test",
        collected_at: "2024-01-15T10:00:00Z",
        status: "ready" as const,
        results: [
          {
            title: "Old",
            url: "https://old.com",
            description: "",
            domain: "old.com",
          },
        ],
      };
      const mockDiff = {
        new_sources: [],
        missing_sources: [],
        persistent_sources: [],
        baseline_total: 1,
        live_total: 1,
        snapshot_id: "s_old",
        collected_at: "2024-01-15T10:00:00Z",
      };

      mockedFetchSnapshot.mockResolvedValueOnce(mockSnapshot);
      mockedCompare.mockReturnValueOnce(mockDiff);

      const res = await POST(
        makeRequest({
          action: "compare",
          snapshot_id: "s_old",
          live_results: [
            {
              title: "Live",
              url: "https://live.com",
              domain: "live.com",
              rrf_score: 0.5,
              query_coverage: 1,
              position: 1,
              source_engine: "google",
              source_query: "test",
              description: "",
            },
          ],
        }),
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.baseline_total).toBe(1);
      expect(data.live_total).toBe(1);
    });

    it("returns 400 when snapshot_id is missing", async () => {
      const res = await POST(
        makeRequest({
          action: "compare",
          live_results: [{ url: "test" }],
        }),
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 when live_results is empty", async () => {
      const res = await POST(
        makeRequest({
          action: "compare",
          snapshot_id: "s_abc",
          live_results: [],
        }),
      );
      expect(res.status).toBe(400);
    });
  });

  it("returns 400 for unknown action", async () => {
    const res = await POST(makeRequest({ action: "unknown" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Unknown action");
  });

  it("returns 500 on internal error", async () => {
    mockedTrigger.mockRejectedValueOnce(new Error("API down"));

    const res = await POST(
      makeRequest({ action: "trigger", queries: ["test"] }),
    );
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe("API down");
  });
});
