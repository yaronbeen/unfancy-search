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

  describe("rule-based expansion (no API key)", () => {
    beforeEach(() => {
      delete process.env.OPENAI_API_KEY;
    });

    it("returns expanded queries using rules", async () => {
      const result = await expandQuery("typescript");
      expect(result).toHaveLength(5);
      expect(result[0]).toBe("typescript"); // original query
    });

    it("respects count parameter", async () => {
      const result = await expandQuery("react", 3);
      expect(result).toHaveLength(3);
    });

    it("includes various angles (best, guide, examples, etc.)", async () => {
      const result = await expandQuery("nodejs", 5);
      expect(result).toContain("nodejs");
      expect(result).toContain("best nodejs");
      expect(result).toContain("nodejs guide");
      expect(result).toContain("nodejs examples");
      expect(result).toContain("nodejs comparison");
    });

    it("lowercases and trims the query", async () => {
      const result = await expandQuery("  TypeScript  ", 2);
      expect(result[0]).toBe("typescript");
    });

    it("handles count larger than templates", async () => {
      const result = await expandQuery("test", 100);
      // Should be capped at the number of templates (15)
      expect(result.length).toBeLessThanOrEqual(15);
      expect(result.length).toBeGreaterThan(0);
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

    it("falls back to rules when LLM returns non-ok", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => "Rate limited",
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await expandQuery("test", 3);

      // Should fall back to rule-based
      expect(result).toHaveLength(3);
      expect(result[0]).toBe("test");
    });

    it("falls back to rules when fetch throws", async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));
      vi.stubGlobal("fetch", mockFetch);

      const result = await expandQuery("test", 3);

      expect(result).toHaveLength(3);
      expect(result[0]).toBe("test");
    });

    it("falls back to rules when LLM returns invalid JSON", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: "not valid json at all",
              },
            },
          ],
        }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await expandQuery("test", 3);

      // Should fall back to rules
      expect(result).toHaveLength(3);
      expect(result[0]).toBe("test");
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
