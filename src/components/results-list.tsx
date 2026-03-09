"use client";

import { motion } from "framer-motion";
import { ExternalLink, Layers, Clipboard, ClipboardCheck } from "lucide-react";
import { useState } from "react";
import type { RankedResult } from "@/lib/types";

interface ResultsListProps {
  results: RankedResult[];
  expandedQueries: string[];
}

export function ResultsList({ results, expandedQueries }: ResultsListProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (results.length === 0) return null;

  const handleCopy = (e: React.MouseEvent, url: string, i: number) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(url).then(() => {
      setCopiedIndex(i);
      setTimeout(() => setCopiedIndex(null), 1500);
    });
  };

  return (
    <div className="space-y-3">
      {/* Sub-queries used — scannable, small */}
      {expandedQueries.length > 1 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex flex-wrap gap-1.5 mb-4"
        >
          <span className="text-xs font-bold uppercase tracking-wide text-gray-500 mr-1 self-center">
            Searched:
          </span>
          {expandedQueries.map((q, i) => (
            <span
              key={i}
              className="text-xs px-2 py-0.5 rounded-md border-2 border-[var(--border)] bg-[var(--surface)] font-medium"
            >
              {q}
            </span>
          ))}
        </motion.div>
      )}

      {/* Results */}
      {results.map((result, i) => (
        <motion.a
          key={`${result.url}-${i}`}
          href={result.url}
          target="_blank"
          rel="noopener noreferrer"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ y: -2, boxShadow: "5px 5px 0 var(--border)" }}
          transition={{
            delay: i * 0.06,
            type: "spring",
            stiffness: 400,
            damping: 30,
          }}
          className="nb-card block p-4 !no-underline group cursor-pointer"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {/* Title — the most important thing (Krug: visual hierarchy) */}
              <h3 className="font-bold text-[15px] leading-snug group-hover:text-[var(--accent-coral)] transition-colors line-clamp-2">
                {result.title || result.url}
              </h3>

              {/* URL — scannable, secondary */}
              <p className="text-xs text-green-700 font-medium mt-1 truncate font-[family-name:var(--font-geist-mono)]">
                {result.domain}
                <span className="text-gray-400">
                  {(() => {
                    try {
                      return new URL(result.url).pathname;
                    } catch {
                      return "";
                    }
                  })()}
                </span>
              </p>

              {/* Description — body text */}
              {result.description && (
                <p className="text-sm text-gray-600 mt-1.5 line-clamp-2 leading-relaxed">
                  {result.description}
                </p>
              )}

              {/* Meta badges — small, informational, don't demand attention */}
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 border border-gray-200 rounded px-1.5 py-0.5">
                  {result.source_engine}
                </span>
                {result.query_coverage > 1 && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent-purple)] border border-[var(--accent-purple)] rounded px-1.5 py-0.5 flex items-center gap-0.5">
                    <Layers className="w-2.5 h-2.5" />
                    {result.query_coverage}× match
                  </span>
                )}
              </div>
            </div>

            {/* Action icons — external link + copy URL */}
            <div className="flex items-center gap-1.5 shrink-0 mt-1">
              <button
                onClick={(e) => handleCopy(e, result.url, i)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:text-[var(--accent-teal)]"
                aria-label="Copy URL"
                title="Copy URL"
              >
                {copiedIndex === i ? (
                  <ClipboardCheck className="w-4 h-4 text-[var(--accent-teal)]" />
                ) : (
                  <Clipboard className="w-4 h-4 text-gray-300" />
                )}
              </button>
              <ExternalLink className="w-4 h-4 text-gray-300 group-hover:text-[var(--accent-coral)] transition-colors" />
            </div>
          </div>
        </motion.a>
      ))}
    </div>
  );
}
