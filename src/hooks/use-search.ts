"use client";

import { useState, useCallback } from "react";
import type { SearchResponse } from "@/lib/types";

export type PipelineStep =
  | "idle"
  | "expanding"
  | "retrieving"
  | "reranking"
  | "done"
  | "error";

export interface SearchFilters {
  geo: string;
  num_results: number;
  research_mode: boolean;
  llm_expansion: boolean;
  domain_include: string[];
  domain_exclude: string[];
}

const DEFAULT_FILTERS: SearchFilters = {
  geo: "us",
  num_results: 10,
  research_mode: false,
  llm_expansion: false,
  domain_include: [],
  domain_exclude: [],
};

export function useSearch() {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [step, setStep] = useState<PipelineStep>("idle");
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(
    async (searchQuery?: string, turnstileToken?: string | null) => {
      const q = (searchQuery ?? query).trim();
      if (!q) return;

      setError(null);
      setResults(null);

      // Step 1: Dispatch to background function
      setStep("expanding");

      try {
        const jobRes = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: q,
            engines: ["google"],
            ...filters,
            turnstileToken: turnstileToken || undefined,
          }),
        });

        if (!jobRes.ok) {
          const data = (await jobRes.json().catch(() => ({}))) as Record<
            string,
            string
          >;
          throw new Error(data.error || `Search failed (${jobRes.status})`);
        }

        const { job_id } = (await jobRes.json()) as { job_id: string };

        // Step 2: Poll for results
        setStep("retrieving");

        const deadline = Date.now() + 120_000;
        while (Date.now() < deadline) {
          await sleep(2500);
          const statusRes = await fetch(`/api/search-status/${job_id}`);
          const data = (await statusRes.json()) as Record<string, unknown>;
          if (data.status === "done") {
            setStep("reranking");
            await sleep(300);
            setResults(data.result as SearchResponse);
            setStep("done");
            return;
          }
          if (data.status === "error") {
            throw new Error((data.error as string) || "Search failed");
          }
          // still pending — keep polling
        }
        throw new Error("Search timed out after 120s");
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
  }, []);

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
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
