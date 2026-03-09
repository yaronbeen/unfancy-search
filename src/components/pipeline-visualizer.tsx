"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Radio, Shuffle, Check, AlertCircle } from "lucide-react";
import type { PipelineStep } from "@/hooks/use-search";

interface PipelineVisualizerProps {
  step: PipelineStep;
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

export function PipelineVisualizer({ step }: PipelineVisualizerProps) {
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
          <div className="flex items-center gap-4">
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
                    className="flex items-center gap-2 flex-1"
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
                            ? "text-[var(--fg)] opacity-60"
                            : "text-gray-400"
                      }`}
                    >
                      {s.label}
                    </span>
                    {i < STEPS.length - 1 && (
                      <div
                        className={`flex-1 h-0.5 mx-1 rounded ${
                          isDone ? "bg-[var(--fg)]" : "bg-gray-200"
                        }`}
                      />
                    )}
                  </motion.div>
                );
              })
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
