"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Minus,
  RefreshCw,
  Database,
  ArrowRightLeft,
  Clock,
} from "lucide-react";
import type { BaselineDiff } from "@/lib/types";

interface BaselineComparisonProps {
  diff: BaselineDiff | null;
  isLoading: boolean;
  onTriggerBaseline: () => void;
  snapshotId: string | null;
  hasResults: boolean;
}

export function BaselineComparison({
  diff,
  isLoading,
  onTriggerBaseline,
  snapshotId,
  hasResults,
}: BaselineComparisonProps) {
  // Don't show anything if no search results yet
  if (!hasResults) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, type: "spring", stiffness: 400, damping: 30 }}
      className="nb-card !shadow-[3px_3px_0_var(--accent-coral)] p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-md bg-[var(--accent-coral)] border-2 border-[var(--border)] flex items-center justify-center">
          <Database className="w-3.5 h-3.5" />
        </div>
        <h3 className="text-xs font-bold uppercase tracking-wide">
          Baseline Comparison
        </h3>
      </div>

      {/* No baseline yet — show trigger button */}
      {!diff && !isLoading && (
        <div className="text-center py-2">
          <p className="text-xs text-gray-500 mb-3">
            Collect a baseline snapshot via Bright Data Datasets API to compare
            against live results. Refresh daily or weekly for drift detection.
          </p>
          <button
            onClick={onTriggerBaseline}
            disabled={!hasResults}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-[var(--accent-coral)] border-2 border-[var(--border)] shadow-[2px_2px_0_var(--border)] hover:shadow-[1px_1px_0_var(--border)] hover:translate-x-[1px] hover:translate-y-[1px] transition-all disabled:opacity-50"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            Compare with baseline
          </button>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-4">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="text-xs text-gray-500">
            {snapshotId
              ? "Fetching baseline snapshot..."
              : "Triggering baseline collection..."}
          </span>
        </div>
      )}

      {/* Diff results */}
      <AnimatePresence>
        {diff && !isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="text-center p-2 rounded-lg bg-[var(--accent-lime)] bg-opacity-20 border border-[var(--accent-lime)]">
                <div className="text-lg font-bold font-[family-name:var(--font-geist-mono)] text-green-700">
                  {diff.new_sources.length}
                </div>
                <div className="text-[10px] text-green-700 uppercase font-semibold flex items-center justify-center gap-0.5">
                  <Plus className="w-2.5 h-2.5" /> New
                </div>
              </div>
              <div className="text-center p-2 rounded-lg bg-red-50 border border-red-200">
                <div className="text-lg font-bold font-[family-name:var(--font-geist-mono)] text-red-600">
                  {diff.missing_sources.length}
                </div>
                <div className="text-[10px] text-red-600 uppercase font-semibold flex items-center justify-center gap-0.5">
                  <Minus className="w-2.5 h-2.5" /> Gone
                </div>
              </div>
              <div className="text-center p-2 rounded-lg bg-gray-50 border border-gray-200">
                <div className="text-lg font-bold font-[family-name:var(--font-geist-mono)]">
                  {diff.persistent_sources.length}
                </div>
                <div className="text-[10px] text-gray-500 uppercase font-semibold">
                  Same
                </div>
              </div>
            </div>

            {/* Baseline metadata */}
            <div className="flex items-center gap-1.5 text-[10px] text-gray-400 mb-3">
              <Clock className="w-3 h-3" />
              <span>
                Baseline: {diff.baseline_total} results collected{" "}
                {diff.collected_at
                  ? new Date(diff.collected_at).toLocaleDateString()
                  : ""}
              </span>
            </div>

            {/* New sources list */}
            {diff.new_sources.length > 0 && (
              <div className="mb-2">
                <div className="text-[10px] font-bold uppercase tracking-wide text-green-700 mb-1 flex items-center gap-1">
                  <Plus className="w-3 h-3" /> New since baseline
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {diff.new_sources.slice(0, 5).map((r, i) => (
                    <div
                      key={i}
                      className="text-[11px] text-gray-600 truncate pl-2 border-l-2 border-green-400"
                    >
                      <span className="font-medium">{r.domain}</span>{" "}
                      <span className="text-gray-400">— {r.title}</span>
                    </div>
                  ))}
                  {diff.new_sources.length > 5 && (
                    <div className="text-[10px] text-gray-400 pl-2">
                      +{diff.new_sources.length - 5} more
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Missing sources list */}
            {diff.missing_sources.length > 0 && (
              <div className="mb-2">
                <div className="text-[10px] font-bold uppercase tracking-wide text-red-600 mb-1 flex items-center gap-1">
                  <Minus className="w-3 h-3" /> Gone since baseline
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {diff.missing_sources.slice(0, 5).map((r, i) => (
                    <div
                      key={i}
                      className="text-[11px] text-gray-600 truncate pl-2 border-l-2 border-red-400"
                    >
                      <span className="font-medium">{r.domain}</span>{" "}
                      <span className="text-gray-400">— {r.title}</span>
                    </div>
                  ))}
                  {diff.missing_sources.length > 5 && (
                    <div className="text-[10px] text-gray-400 pl-2">
                      +{diff.missing_sources.length - 5} more
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Refresh hint */}
            <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between">
              <span className="text-[10px] text-gray-400">
                Refresh baseline daily or weekly to track drift
              </span>
              <button
                onClick={onTriggerBaseline}
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-500 hover:text-gray-700 transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                Refresh
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
