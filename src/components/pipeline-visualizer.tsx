"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Radio, Shuffle, Check, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";
import type { PipelineStep } from "@/hooks/use-search";

interface PipelineVisualizerProps {
  step: PipelineStep;
  resultCount?: number;
}

const STEPS = [
  {
    key: "expanding",
    label: "Expanding query",
    icon: Sparkles,
    color: "var(--accent-purple)",
  },
  {
    key: "retrieving",
    label: "Searching SERP",
    icon: Radio,
    color: "var(--accent-teal)",
  },
  {
    key: "reranking",
    label: "Reranking results",
    icon: Shuffle,
    color: "var(--accent-yellow)",
  },
] as const;

const WITTY_MESSAGES = [
  "Crawling the real web, not a cached index...",
  "No fancy API markup — raw SERP data incoming...",
  "Bright Data doing the heavy lifting...",
  "Your query is hitting actual Google results...",
  "Worth the wait — no hallucinated links here...",
];

export function PipelineVisualizer({
  step,
  resultCount,
}: PipelineVisualizerProps) {
  const [elapsed, setElapsed] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);
  const [showHint, setShowHint] = useState(false);

  // Elapsed timer — runs only while step === "retrieving"
  useEffect(() => {
    if (step !== "retrieving") {
      setElapsed(0);
      setShowHint(false);
      return;
    }

    const timer = setInterval(() => {
      setElapsed((s) => s + 1);
    }, 1000);

    const hintTimer = setTimeout(() => {
      setShowHint(true);
    }, 5000);

    return () => {
      clearInterval(timer);
      clearTimeout(hintTimer);
    };
  }, [step]);

  // Rotating messages — cycles every 4s while step === "retrieving"
  useEffect(() => {
    if (step !== "retrieving") {
      setMessageIndex(0);
      return;
    }

    const rotator = setInterval(() => {
      setMessageIndex((i) => (i + 1) % WITTY_MESSAGES.length);
    }, 4000);

    return () => clearInterval(rotator);
  }, [step]);

  if (step === "idle" || step === "done") return null;

  const currentIdx = STEPS.findIndex((s) => s.key === step);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="w-full max-w-2xl mx-auto mt-6"
      >
        <div className="nb-card !shadow-[3px_3px_0_var(--border)] p-4">
          <div className="flex items-center gap-2 sm:gap-4">
            {step === "error" ? (
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className="flex items-center gap-3 text-sm font-medium"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center border-2 border-[var(--border)]"
                  style={{ background: "var(--accent-coral)" }}
                >
                  <AlertCircle className="w-4 h-4" />
                </div>
                <span>Something went wrong</span>
              </motion.div>
            ) : (
              STEPS.map((s, i) => {
                const isActive = s.key === step;
                const isDone = i < currentIdx;
                const Icon = s.icon;

                return (
                  <motion.div
                    key={s.key}
                    className={`items-center gap-2 flex-1 ${isActive || isDone ? "flex" : "hidden sm:flex"}`}
                    initial={false}
                  >
                    <motion.div
                      className="w-8 h-8 rounded-full flex items-center justify-center border-2 border-[var(--border)] shrink-0"
                      style={{
                        background: isDone || isActive ? s.color : "#e5e5e5",
                      }}
                      animate={isActive ? { scale: [1, 1.1, 1] } : { scale: 1 }}
                      transition={
                        isActive ? { repeat: Infinity, duration: 0.8 } : {}
                      }
                    >
                      {isDone ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Icon className="w-4 h-4" />
                      )}
                    </motion.div>
                    <span
                      className={`text-xs font-semibold whitespace-nowrap ${
                        isActive
                          ? "text-[var(--fg)]"
                          : isDone
                            ? "text-[var(--fg)] opacity-60 hidden sm:inline"
                            : "text-gray-400 hidden sm:inline"
                      }`}
                    >
                      {s.label}
                      {isActive && s.key === "retrieving" && elapsed > 0 && (
                        <span className="ml-1 font-mono opacity-70">
                          {elapsed}s
                        </span>
                      )}
                      {isActive &&
                        s.key === "reranking" &&
                        resultCount !== undefined && (
                          <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="ml-1.5 text-[10px] font-mono bg-[var(--accent-yellow)] border border-[var(--border)] rounded px-1.5 py-0.5"
                          >
                            {resultCount} results
                          </motion.span>
                        )}
                    </span>
                    {i < STEPS.length - 1 && (
                      <div
                        className={`flex-1 h-0.5 mx-1 rounded hidden sm:block ${
                          isDone ? "bg-[var(--fg)]" : "bg-gray-200"
                        }`}
                      />
                    )}
                  </motion.div>
                );
              })
            )}
          </div>

          {/* Rotating witty messages + 90s hint — only during SERP retrieval */}
          {step === "retrieving" && (
            <div className="mt-3 space-y-1">
              <AnimatePresence mode="wait">
                <motion.p
                  key={messageIndex}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.4 }}
                  className="text-xs text-gray-700 italic"
                >
                  {WITTY_MESSAGES[messageIndex]}
                </motion.p>
              </AnimatePresence>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: showHint ? 0.85 : 0 }}
                transition={{ duration: 0.6 }}
                className="text-xs text-[var(--fg)] font-medium"
              >
                Real SERP calls can take up to 90s — hang tight!
              </motion.p>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
