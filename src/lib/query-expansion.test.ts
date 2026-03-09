import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { expandQuery } from "./query-expansion";

describe("expandQuery", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("missing API key", () => {
    beforeEach(() => {
      delete process.env.OPENAI_API_KEY;
    });

    it("throws error when OPENAI_API_KEY is not set", async () => {
      await expect(expandQuery("typescript")).rejects.toThrow(
        "OPENAI_API_KEY is not set",
      );
    });
  });

  describe("LLM-based expansion", () => {
    beforeEach(() => {
      process.env.OPENAI_API_KEY = "test-key";
    });

    it("calls OpenAI API when key is available", async () => {
      const mockQueries = [
        "typescript basics",
        "typescript tutorial",
        "learn typescript",
      ];
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify(mockQueries),
              },
            },
          ],
        }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await expandQuery("typescript", 3);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockQueries);
    });

    it("handles markdown code fences in LLM response", async () => {
      const mockQueries = ["query1", "query2"];
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: "```json\n" + JSON.stringify(mockQueries) + "\n```",
              },
            },
          ],
        }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await expandQuery("test", 2);
      expect(result).toEqual(mockQueries);
    });

    it("slices result to requested count", async () => {
      const mockQueries = ["q1", "q2", "q3", "q4", "q5"];
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify(mockQueries),
              },
            },
          ],
        }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await expandQuery("test", 2);
      expect(result).toHaveLength(2);
    });
  });
});
