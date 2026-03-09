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
