"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useSearch } from "@/hooks/use-search";
import { SearchBox } from "@/components/search-box";
import { FilterPanel } from "@/components/filter-panel";
import { PipelineVisualizer } from "@/components/pipeline-visualizer";
import { ResultsList } from "@/components/results-list";
import { DomainClusters } from "@/components/domain-clusters";
import { CostComparison } from "@/components/cost-comparison";
import { useState } from "react";
import { LayoutGrid, List } from "lucide-react";

export default function Home() {
  const {
    query,
    setQuery,
    filters,
    updateFilter,
    results,
    step,
    error,
    search,
    isSearching,
  } = useSearch();

  const [view, setView] = useState<"list" | "clusters">("list");
  const hasResults = results !== null;
  const showHero = !hasResults && step === "idle";

  return (
    <main className="min-h-screen px-4 pb-20">
      {/* Hero — only visible before first search (Krug: don't make me think where to start) */}
      <AnimatePresence mode="wait">
        {showHero && (
          <motion.div
            key="hero"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center justify-center min-h-[50vh] pt-20"
          >
            <motion.h1
              className="text-5xl sm:text-7xl font-bold tracking-tight text-center mb-2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 25,
                delay: 0.1,
              }}
            >
              <span className="inline-block px-3 py-1 bg-[var(--accent-yellow)] border-[3px] border-[var(--border)] rounded-xl -rotate-1 shadow-[4px_4px_0_var(--border)]">
                un
              </span>
              fancy
            </motion.h1>
            <motion.p
              className="text-lg text-gray-500 text-center max-w-md mt-4 font-medium"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              SERP retrieval + query expansion + RRF reranking.
              <br />
              <span className="text-[var(--fg)] font-semibold">
                No fancy search API required.
              </span>
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search area — always present, moves to top after first search */}
      <motion.div
        layout
        className={`${showHero ? "" : "pt-6 sticky top-0 z-40 bg-[var(--bg)] pb-2"}`}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        {/* Compact header when results visible */}
        {!showHero && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="max-w-2xl mx-auto mb-3"
          >
            <button
              onClick={() => window.location.reload()}
              className="text-xl font-bold tracking-tight hover:opacity-70 transition-opacity"
            >
              <span className="inline-block px-1.5 py-0.5 bg-[var(--accent-yellow)] border-2 border-[var(--border)] rounded-md text-sm -rotate-1 shadow-[2px_2px_0_var(--border)]">
                un
              </span>
              <span className="text-base">fancy</span>
            </button>
          </motion.div>
        )}

        <SearchBox
          query={query}
          onQueryChange={setQuery}
          onSearch={search}
          isSearching={isSearching}
          hasResults={hasResults}
        />
        <FilterPanel
          filters={filters}
          onUpdate={updateFilter}
          isSearching={isSearching}
        />
      </motion.div>

      {/* Pipeline progress — shows only during search */}
      <PipelineVisualizer step={step} />

      {/* Error — clear, no jargon */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-2xl mx-auto mt-6"
          >
            <div className="nb-card !border-[var(--accent-coral)] !shadow-[4px_4px_0_var(--accent-coral)] p-4">
              <p className="text-sm font-semibold text-[var(--accent-coral)]">
                {error}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      <AnimatePresence>
        {results && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="max-w-5xl mx-auto mt-6"
          >
            {/* Result count + view toggle */}
            <div className="flex items-center justify-between mb-4 px-1">
              <p className="text-sm text-gray-500">
                <span className="font-bold text-[var(--fg)] font-[family-name:var(--font-geist-mono)]">
                  {results.results.length}
                </span>{" "}
                results from{" "}
                <span className="font-bold text-[var(--fg)] font-[family-name:var(--font-geist-mono)]">
                  {results.meta.total_serp_results}
                </span>{" "}
                raw hits
              </p>
              <div className="flex gap-1">
                <button
                  onClick={() => setView("list")}
                  className={`p-1.5 rounded-md border-2 transition-colors ${
                    view === "list"
                      ? "border-[var(--border)] bg-[var(--accent-yellow)]"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  aria-label="List view"
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setView("clusters")}
                  className={`p-1.5 rounded-md border-2 transition-colors ${
                    view === "clusters"
                      ? "border-[var(--border)] bg-[var(--accent-yellow)]"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  aria-label="Cluster view"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Two-column: results + sidebar */}
            <div className="flex gap-6 items-start">
              <div className="flex-1 min-w-0">
                {view === "list" ? (
                  <ResultsList
                    results={results.results}
                    expandedQueries={results.expanded_queries}
                  />
                ) : (
                  <DomainClusters clusters={results.clusters} />
                )}
              </div>

              {/* Sidebar */}
              <div className="hidden lg:block w-72 shrink-0 space-y-4 sticky top-28">
                <CostComparison meta={results.meta} />
                {view === "list" && results.clusters.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                  >
                    <DomainClusters clusters={results.clusters} />
                  </motion.div>
                )}
              </div>
            </div>

            {/* Mobile cost — below results */}
            <div className="lg:hidden mt-6">
              <CostComparison meta={results.meta} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
