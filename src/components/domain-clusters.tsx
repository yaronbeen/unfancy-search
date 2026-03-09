"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ExternalLink } from "lucide-react";
import { useState } from "react";
import type { DomainCluster } from "@/lib/types";

interface DomainClustersProps {
  clusters: DomainCluster[];
}

const CLUSTER_COLORS = [
  "var(--accent-yellow)",
  "var(--accent-teal)",
  "var(--accent-coral)",
  "var(--accent-purple)",
  "var(--accent-lime)",
];

export function DomainClusters({ clusters }: DomainClustersProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (clusters.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">
        Sources by domain
      </h3>
      {clusters.slice(0, 12).map((cluster, i) => {
        const isOpen = expanded === cluster.domain;
        const color = CLUSTER_COLORS[i % CLUSTER_COLORS.length];

        return (
          <motion.div
            key={cluster.domain}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <button
              onClick={() => setExpanded(isOpen ? null : cluster.domain)}
              className="w-full flex items-center gap-2 p-2.5 rounded-lg border-2 border-[var(--border)] bg-[var(--surface)] hover:bg-gray-50 transition-colors text-left"
            >
              <div
                className="w-6 h-6 rounded-md border-2 border-[var(--border)] flex items-center justify-center text-[10px] font-bold font-[family-name:var(--font-geist-mono)] shrink-0"
                style={{ background: color }}
              >
                {cluster.count}
              </div>
              <span className="text-sm font-semibold truncate flex-1">
                {cluster.domain}
              </span>
              <motion.div
                animate={{ rotate: isOpen ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </motion.div>
            </button>

            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  className="overflow-hidden"
                >
                  <div className="pl-4 pt-1 pb-2 space-y-1">
                    {cluster.results.map((r, j) => (
                      <a
                        key={j}
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-gray-50 transition-colors group"
                      >
                        <span className="text-xs font-medium text-[var(--fg)] truncate flex-1 group-hover:text-[var(--accent-coral)] transition-colors">
                          {r.title}
                        </span>
                        <ExternalLink className="w-3 h-3 text-gray-300 group-hover:text-[var(--accent-coral)] shrink-0" />
                      </a>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}
