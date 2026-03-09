"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useSearch } from "@/hooks/use-search";
import { SearchBox } from "@/components/search-box";
import { FilterPanel } from "@/components/filter-panel";
import { PipelineVisualizer } from "@/components/pipeline-visualizer";
import { ResultsList } from "@/components/results-list";
import { DomainClusters } from "@/components/domain-clusters";
import { CostComparison } from "@/components/cost-comparison";
import { BaselineComparison } from "@/components/baseline-comparison";
import { useState, useEffect, Suspense } from "react";
import {
  LayoutGrid,
  List,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

// Inner component that reads ?q= — must be inside <Suspense>
function SearchParamSync({ onQuery }: { onQuery: (q: string) => void }) {
  const searchParams = useSearchParams();
  useEffect(() => {
    const q = searchParams.get("q");
    if (q) onQuery(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

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
    reset,
    isSearching,
    baselineDiff,
    baselineLoading,
    baselineSnapshotId,
    compareBaseline,
  } = useSearch();

  const router = useRouter();
  const [view, setView] = useState<"list" | "clusters">("list");
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);

  const hasResults = results !== null;
  const showHero = !hasResults && step === "idle";

  // Sync URL when search completes
  useEffect(() => {
    if (step === "done" && query) {
      router.replace(`?q=${encodeURIComponent(query)}`, { scroll: false });
    }
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleReset = () => {
    reset();
    router.replace("/", { scroll: false });
  };

  // Called by SearchParamSync on mount if ?q= is present
  const handleAutoSearch = (q: string) => {
    setQuery(q);
    search(q);
  };

  return (
    <main className="min-h-screen px-4 pb-20">
      {/* Sync ?q= param on mount */}
      <Suspense fallback={null}>
        <SearchParamSync onQuery={handleAutoSearch} />
      </Suspense>

      {/* Hero — only visible before first search */}
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

            {/* How it works — expandable */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="w-full max-w-2xl mt-8"
            >
              <button
                onClick={() => setHowItWorksOpen((o) => !o)}
                className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-[var(--fg)] transition-colors mx-auto"
              >
                {howItWorksOpen ? (
                  <>
                    How it works <ChevronUp className="w-4 h-4" />
                  </>
                ) : (
                  <>
                    How it works <ChevronDown className="w-4 h-4" />
                  </>
                )}
              </button>

              <AnimatePresence>
                {howItWorksOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Step 1 */}
                      <div className="nb-card p-4 !shadow-[3px_3px_0_var(--border)]">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center border-2 border-[var(--border)] mb-2"
                          style={{ background: "var(--accent-purple)" }}
                        >
                          <span className="text-xs font-bold">1</span>
                        </div>
                        <h3 className="font-bold text-sm mb-1">
                          Query Expansion
                        </h3>
                        <p className="text-xs text-gray-500 leading-relaxed">
                          Claude AI expands your query into semantic variants to
                          maximize recall across different phrasings.
                        </p>
                      </div>

                      {/* Step 2 */}
                      <div className="nb-card p-4 !shadow-[3px_3px_0_var(--border)]">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center border-2 border-[var(--border)] mb-2"
                          style={{ background: "var(--accent-teal)" }}
                        >
                          <span className="text-xs font-bold">2</span>
                        </div>
                        <h3 className="font-bold text-sm mb-1">
                          Bright Data SERP
                        </h3>
                        <p className="text-xs text-gray-500 leading-relaxed">
                          We hit real Google results via{" "}
                          <a
                            href="https://brightdata.com/products/serp-api"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-[var(--fg)] underline underline-offset-2"
                          >
                            Bright Data&apos;s SERP API
                          </a>{" "}
                          — no cached index, no hallucinated links.
                          ~$0.001/query.
                        </p>
                      </div>

                      {/* Step 3 */}
                      <div className="nb-card p-4 !shadow-[3px_3px_0_var(--border)]">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center border-2 border-[var(--border)] mb-2"
                          style={{ background: "var(--accent-yellow)" }}
                        >
                          <span className="text-xs font-bold">3</span>
                        </div>
                        <h3 className="font-bold text-sm mb-1">
                          RRF Reranking
                        </h3>
                        <p className="text-xs text-gray-500 leading-relaxed">
                          Reciprocal Rank Fusion merges results from all query
                          variants. Better signal than any single ranking.
                        </p>
                      </div>
                    </div>

                    {/* Cost math */}
                    <div className="mt-3 nb-card p-3 !shadow-[3px_3px_0_var(--border)] bg-[var(--accent-yellow)] !border-[var(--border)]">
                      <p className="text-xs font-semibold text-center">
                        💰 This search costs ~$0.003 total.{" "}
                        <span className="opacity-70">
                          A fancy search API charges $0.01–$0.05 per query.
                        </span>
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
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
            className="max-w-2xl mx-auto mb-3 flex items-center gap-3"
          >
            <button
              onClick={handleReset}
              className="text-xl font-bold tracking-tight hover:opacity-70 transition-opacity"
            >
              <span className="inline-block px-1.5 py-0.5 bg-[var(--accent-yellow)] border-2 border-[var(--border)] rounded-md text-sm -rotate-1 shadow-[2px_2px_0_var(--border)]">
                un
              </span>
              <span className="text-base">fancy</span>
            </button>
            <button
              onClick={handleReset}
              className="flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-[var(--fg)] transition-colors"
            >
              <ArrowLeft className="w-3 h-3" />
              New search
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
      <PipelineVisualizer step={step} resultCount={results?.results.length} />

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
                <BaselineComparison
                  diff={baselineDiff}
                  isLoading={baselineLoading}
                  onTriggerBaseline={() => compareBaseline()}
                  snapshotId={baselineSnapshotId}
                  hasResults={hasResults}
                />
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

      {/* Footer — Powered by Bright Data */}
      <footer className="fixed bottom-0 left-0 right-0 py-2 text-center bg-[var(--bg)] border-t border-gray-200/50">
        <a
          href="https://brightdata.com/products/serp-api"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] text-gray-400 hover:text-[var(--fg)] transition-colors font-medium"
        >
          Powered by <span className="font-bold">Bright Data</span> SERP API
        </a>
      </footer>
    </main>
  );
}
