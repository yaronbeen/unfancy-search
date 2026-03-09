"use client";

import { motion } from "framer-motion";
import { DollarSign, TrendingDown } from "lucide-react";
import { useEffect, useState } from "react";
import type { SearchMeta } from "@/lib/types";

interface CostComparisonProps {
  meta: SearchMeta;
}

// Competitor pricing (per request)
const EXA_PER_REQUEST = 0.007;
const TAVILY_PER_REQUEST = 0.008;

export function CostComparison({ meta }: CostComparisonProps) {
  const [animatedCost, setAnimatedCost] = useState(0);
  const actualCost = meta.estimated_cost_usd;
  const exaCost = meta.queries_executed * EXA_PER_REQUEST;
  const tavilyCost = meta.queries_executed * TAVILY_PER_REQUEST;
  const savings = Math.round((1 - actualCost / exaCost) * 100);

  // Count-up animation
  useEffect(() => {
    const duration = 600;
    const steps = 30;
    const increment = actualCost / steps;
    let current = 0;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      current += increment;
      if (step >= steps) {
        setAnimatedCost(actualCost);
        clearInterval(timer);
      } else {
        setAnimatedCost(current);
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [actualCost]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, type: "spring", stiffness: 400, damping: 30 }}
      className="nb-card !shadow-[3px_3px_0_var(--accent-yellow)] p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-md bg-[var(--accent-yellow)] border-2 border-[var(--border)] flex items-center justify-center">
          <DollarSign className="w-3.5 h-3.5" />
        </div>
        <h3 className="text-xs font-bold uppercase tracking-wide">
          Cost of this search
        </h3>
      </div>

      {/* The hero number */}
      <div className="text-center mb-3">
        <span className="text-3xl font-bold font-[family-name:var(--font-geist-mono)]">
          ${animatedCost.toFixed(4)}
        </span>
      </div>

      {/* Comparison table — scannable */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[var(--accent-yellow)] border border-[var(--border)]" />
            This search
          </span>
          <span className="font-bold font-[family-name:var(--font-geist-mono)]">
            ${actualCost.toFixed(4)}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-gray-300" />
            Exa (same queries)
          </span>
          <span className="font-[family-name:var(--font-geist-mono)]">
            ${exaCost.toFixed(4)}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-gray-300" />
            Tavily (same queries)
          </span>
          <span className="font-[family-name:var(--font-geist-mono)]">
            ${tavilyCost.toFixed(4)}
          </span>
        </div>
      </div>

      {/* Savings badge */}
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.6, type: "spring" }}
        className="mt-3 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-[var(--accent-lime)] border-2 border-[var(--border)]"
      >
        <TrendingDown className="w-3.5 h-3.5" />
        <span className="text-xs font-bold">
          ~{savings}% less than a fancy API
        </span>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t-2 border-gray-100">
        <div className="text-center">
          <div className="text-lg font-bold font-[family-name:var(--font-geist-mono)]">
            {meta.queries_executed}
          </div>
          <div className="text-[10px] text-gray-500 uppercase font-semibold">
            SERP calls
          </div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold font-[family-name:var(--font-geist-mono)]">
            {meta.unique_after_dedup}
          </div>
          <div className="text-[10px] text-gray-500 uppercase font-semibold">
            Unique results
          </div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold font-[family-name:var(--font-geist-mono)]">
            {(meta.duration_ms / 1000).toFixed(1)}s
          </div>
          <div className="text-[10px] text-gray-500 uppercase font-semibold">
            Duration
          </div>
        </div>
      </div>
    </motion.div>
  );
}
