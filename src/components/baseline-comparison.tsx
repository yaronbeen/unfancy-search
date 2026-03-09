"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Equal,
  RefreshCw,
  Database,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { useState } from "react";
import type { BaselineComparison } from "@/hooks/use-baseline";

interface BaselineComparisonProps {
  comparison: BaselineComparison | null;
  isCollecting: boolean;
  collectError: string | null;
  baselineAge: string | null;
  hasResults: boolean;
  onCollect: () => void;
}

interface SourceSectionProps {
  title: string;
  count: number;
  items: { url: string; title: string; domain: string }[];
  color: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
}

function SourceSection({
  title,
  count,
  items,
  color,
  icon,
  defaultOpen = false,
}: SourceSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  if (count === 0) return null;

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full text-left group"
      >
        <span
          className="flex items-center justify-center w-6 h-6 rounded-md border-2 border-[var(--border)]"
          style={{ background: color }}
        >
          {icon}
        </span>
        <span className="text-sm font-bold flex-1">
          {title}{" "}
          <span className="font-[family-name:var(--font-geist-mono)]">
            ({count})
          </span>
        </span>
        {open ? (
          <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="mt-2 ml-8 space-y-1.5">
              {items.slice(0, 10).map((item) => (
                <a
                  key={item.url}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block group/link"
                >
                  <p className="text-xs font-semibold text-[var(--fg)] group-hover/link:underline underline-offset-2 truncate">
                    {item.title || item.url}
                  </p>
                  <p className="text-[10px] text-gray-400 truncate">
                    {item.domain}
                  </p>
                </a>
              ))}
              {items.length > 10 && (
                <p className="text-[10px] text-gray-400 font-medium">
                  +{items.length - 10} more
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function BaselineComparisonPanel({
  comparison,
  isCollecting,
  collectError,
  baselineAge,
  hasResults,
  onCollect,
}: BaselineComparisonProps) {
  if (!hasResults) return null;

  // No baseline yet — show collect button
  if (!comparison && !isCollecting) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="nb-card !shadow-[3px_3px_0_var(--border)] p-4"
      >
        <div className="flex items-center gap-2 mb-3">
          <Database className="w-4 h-4" />
          <h3 className="text-sm font-bold">Baseline Comparison</h3>
        </div>
        <p className="text-xs text-gray-500 mb-3 leading-relaxed">
          Collect a historical snapshot via{" "}
          <span className="font-semibold text-[var(--fg)]">
            Bright Data Datasets API
          </span>
          . Future searches will show what&apos;s new and what&apos;s changed.
        </p>
        <button
          onClick={onCollect}
          className="nb-btn nb-btn-sm !gap-1.5 text-xs w-full justify-center"
        >
          <Database className="w-3.5 h-3.5" />
          Collect Baseline
        </button>
        {collectError && (
          <div className="mt-2 flex items-start gap-1.5 text-xs text-[var(--accent-coral)]">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{collectError}</span>
          </div>
        )}
        <p className="text-[10px] text-gray-400 mt-2 text-center">
          Refresh your baseline daily or weekly to track result drift.
        </p>
      </motion.div>
    );
  }

  // Collecting in progress
  if (isCollecting) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="nb-card !shadow-[3px_3px_0_var(--border)] p-4"
      >
        <div className="flex items-center gap-2 mb-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <h3 className="text-sm font-bold">Collecting Baseline...</h3>
        </div>
        <p className="text-xs text-gray-500 leading-relaxed">
          The Bright Data Datasets API is collecting a SERP snapshot. This
          typically takes 1-3 minutes.
        </p>
        <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
          <motion.div
            className="h-full bg-[var(--accent-teal)] rounded-full"
            initial={{ width: "5%" }}
            animate={{ width: "85%" }}
            transition={{ duration: 120, ease: "linear" }}
          />
        </div>
      </motion.div>
    );
  }

  // Comparison available
  if (!comparison) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="nb-card !shadow-[3px_3px_0_var(--border)] p-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4" />
          <h3 className="text-sm font-bold">Baseline vs Live</h3>
        </div>
        <button
          onClick={onCollect}
          disabled={isCollecting}
          className="flex items-center gap-1 text-[10px] font-semibold text-gray-400 hover:text-[var(--fg)] transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          Refresh
        </button>
      </div>

      {/* Baseline meta */}
      <div className="text-[10px] text-gray-400 mb-3 flex items-center gap-2">
        <span>
          Baseline: {baselineAge} ({comparison.baseline_count} URLs)
        </span>
        <span>·</span>
        <span>Live: {comparison.live_count} URLs</span>
      </div>

      {/* Summary badges */}
      <div className="flex gap-2 mb-4">
        <span className="px-2 py-0.5 text-[10px] font-bold rounded-md border-2 border-[var(--border)] bg-[var(--accent-teal)]">
          +{comparison.new_sources.length} new
        </span>
        <span className="px-2 py-0.5 text-[10px] font-bold rounded-md border-2 border-[var(--border)] bg-[var(--accent-coral)]">
          -{comparison.gone_sources.length} gone
        </span>
        <span className="px-2 py-0.5 text-[10px] font-bold rounded-md border-2 border-[var(--border)] bg-[var(--accent-yellow)]">
          ={comparison.persistent.length} same
        </span>
      </div>

      {/* Source sections */}
      <div className="space-y-3">
        <SourceSection
          title="New Sources"
          count={comparison.new_sources.length}
          items={comparison.new_sources}
          color="var(--accent-teal)"
          icon={<TrendingUp className="w-3.5 h-3.5" />}
          defaultOpen={true}
        />
        <SourceSection
          title="Gone Sources"
          count={comparison.gone_sources.length}
          items={comparison.gone_sources}
          color="var(--accent-coral)"
          icon={<TrendingDown className="w-3.5 h-3.5" />}
        />
        <SourceSection
          title="Persistent"
          count={comparison.persistent.length}
          items={comparison.persistent}
          color="var(--accent-yellow)"
          icon={<Equal className="w-3.5 h-3.5" />}
        />
      </div>

      {/* Refresh note */}
      <p className="text-[10px] text-gray-400 mt-3 text-center border-t border-gray-100 pt-2">
        Refresh your baseline daily or weekly to track how search results
        evolve.
      </p>
    </motion.div>
  );
}
