"use client";

import { useState, useCallback } from "react";
import type { SearchResponse, BaselineDiff } from "@/lib/types";

export type PipelineStep =
  | "idle"
  | "expanding"
  | "retrieving"
  | "reranking"
  | "done"
  | "error";

export interface SearchFilters {
  engines: ("google" | "bing")[];
  geo: string;
  num_results: number;
  research_mode: boolean;
  domain_include: string[];
  domain_exclude: string[];
}

const DEFAULT_FILTERS: SearchFilters = {
  engines: ["google"],
  geo: "us",
  num_results: 10,
  research_mode: false,
  domain_include: [],
  domain_exclude: [],
};

export function useSearch() {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [step, setStep] = useState<PipelineStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [baselineDiff, setBaselineDiff] = useState<BaselineDiff | null>(null);
  const [baselineLoading, setBaselineLoading] = useState(false);
  const [baselineSnapshotId, setBaselineSnapshotId] = useState<string | null>(
    null,
  );

  const search = useCallback(
    async (searchQuery?: string) => {
      const q = (searchQuery ?? query).trim();
      if (!q) return;

      setError(null);
      setResults(null);

      // Simulate pipeline steps for UX feedback
      setStep("expanding");
      await sleep(400);
      setStep("retrieving");

      try {
        const res = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: q,
            ...filters,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Search failed (${res.status})`);
        }

        setStep("reranking");
        await sleep(300);

        const data: SearchResponse = await res.json();
        setResults(data);
        setStep("done");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Search failed");
        setStep("error");
      }
    },
    [query, filters],
  );

  const updateFilter = useCallback(
    <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const reset = useCallback(() => {
    setQuery("");
    setResults(null);
    setStep("idle");
    setError(null);
    setBaselineDiff(null);
    setBaselineSnapshotId(null);
  }, []);

  const compareBaseline = useCallback(
    async (snapshotId?: string) => {
      if (!results) return;

      setBaselineLoading(true);
      try {
        const res = await fetch("/api/baseline", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            snapshotId
              ? {
                  action: "compare",
                  snapshot_id: snapshotId,
                  live_results: results.results,
                }
              : {
                  action: "trigger",
                  queries: results.expanded_queries,
                  engine: filters.engines[0] || "google",
                  geo: filters.geo,
                },
          ),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Baseline operation failed");
        }

        const data = await res.json();

        if (data.snapshot_id && !data.new_sources) {
          // Trigger response — store snapshot_id and poll
          setBaselineSnapshotId(data.snapshot_id);
          // For demo: immediately try to compare (in production, poll status first)
          setTimeout(() => compareBaseline(data.snapshot_id), 3000);
        } else {
          // Compare response — show diff
          setBaselineDiff(data as BaselineDiff);
          setBaselineSnapshotId(data.snapshot_id);
        }
      } catch (err) {
        console.error("Baseline error:", err);
        setBaselineDiff(null);
      } finally {
        setBaselineLoading(false);
      }
    },
    [results, filters],
  );

  return {
    query,
    setQuery,
    filters,
    updateFilter,
    setFilters,
    results,
    step,
    error,
    search,
    reset,
    isSearching:
      step === "expanding" || step === "retrieving" || step === "reranking",
    baselineDiff,
    baselineLoading,
    baselineSnapshotId,
    compareBaseline,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
