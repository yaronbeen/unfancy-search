"use client";

import { motion, AnimatePresence } from "framer-motion";
import { SlidersHorizontal, X, Globe, Monitor, Zap } from "lucide-react";
import { useState } from "react";
import type { SearchFilters } from "@/hooks/use-search";

interface FilterPanelProps {
  filters: SearchFilters;
  onUpdate: <K extends keyof SearchFilters>(
    key: K,
    value: SearchFilters[K],
  ) => void;
  isSearching: boolean;
}

const GEOS = [
  { code: "us", label: "US" },
  { code: "gb", label: "UK" },
  { code: "de", label: "DE" },
  { code: "fr", label: "FR" },
  { code: "il", label: "IL" },
  { code: "in", label: "IN" },
  { code: "jp", label: "JP" },
  { code: "br", label: "BR" },
];

export function FilterPanel({
  filters,
  onUpdate,
  isSearching,
}: FilterPanelProps) {
  const [open, setOpen] = useState(false);
  const [domainInput, setDomainInput] = useState("");
  const [excludeInput, setExcludeInput] = useState("");

  const toggleEngine = (engine: "google" | "bing") => {
    const current = filters.engines;
    if (current.includes(engine)) {
      if (current.length > 1) {
        onUpdate(
          "engines",
          current.filter((e) => e !== engine),
        );
      }
    } else {
      onUpdate("engines", [...current, engine]);
    }
  };

  const addDomain = (type: "include" | "exclude") => {
    const input = type === "include" ? domainInput : excludeInput;
    const domain = input.trim().toLowerCase();
    if (!domain) return;
    const key = type === "include" ? "domain_include" : "domain_exclude";
    const current = filters[key];
    if (!current.includes(domain)) {
      onUpdate(key, [...current, domain]);
    }
    if (type === "include") setDomainInput("");
    else setExcludeInput("");
  };

  const removeDomain = (type: "include" | "exclude", domain: string) => {
    const key = type === "include" ? "domain_include" : "domain_exclude";
    onUpdate(
      key,
      filters[key].filter((d) => d !== domain),
    );
  };

  return (
    <div className="w-full max-w-2xl mx-auto mt-3">
      <div className="flex items-center gap-3">
        <motion.button
          onClick={() => setOpen(!open)}
          className="nb-btn nb-btn-sm !gap-1.5 text-xs"
          whileTap={{ scale: 0.95 }}
          disabled={isSearching}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filters
        </motion.button>

        {/* Research mode toggle — always visible, it's a power feature */}
        <motion.button
          onClick={() => onUpdate("research_mode", !filters.research_mode)}
          className={`nb-btn nb-btn-sm !gap-1.5 text-xs ${
            filters.research_mode ? "!bg-[var(--accent-purple)] text-white" : ""
          }`}
          whileTap={{ scale: 0.95 }}
          disabled={isSearching}
        >
          <Zap className="w-3.5 h-3.5" />
          Deep Research
        </motion.button>

        {/* Quick engine pills */}
        <div className="flex gap-1.5 ml-auto">
          {(["google", "bing"] as const).map((engine) => (
            <motion.button
              key={engine}
              onClick={() => toggleEngine(engine)}
              className={`nb-btn nb-btn-sm text-xs capitalize ${
                filters.engines.includes(engine)
                  ? "!bg-[var(--accent-yellow)]"
                  : "opacity-50"
              }`}
              whileTap={{ scale: 0.95 }}
              disabled={isSearching}
            >
              <Globe className="w-3 h-3" />
              {engine}
            </motion.button>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="overflow-hidden"
          >
            <div className="nb-card !shadow-[3px_3px_0_var(--border)] mt-3 p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Geo */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide mb-2 block">
                    Region
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {GEOS.map((geo) => (
                      <button
                        key={geo.code}
                        onClick={() => onUpdate("geo", geo.code)}
                        className={`px-3 py-1 text-xs font-bold border-2 border-[var(--border)] rounded-md transition-colors ${
                          filters.geo === geo.code
                            ? "bg-[var(--accent-yellow)]"
                            : "bg-[var(--surface)] hover:bg-gray-100"
                        }`}
                      >
                        {geo.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Result count */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide mb-2 block">
                    Results per query
                  </label>
                  <div className="flex gap-1.5">
                    {[10, 20, 50].map((n) => (
                      <button
                        key={n}
                        onClick={() => onUpdate("num_results", n)}
                        className={`px-3 py-1 text-xs font-bold border-2 border-[var(--border)] rounded-md transition-colors font-[family-name:var(--font-geist-mono)] ${
                          filters.num_results === n
                            ? "bg-[var(--accent-yellow)]"
                            : "bg-[var(--surface)] hover:bg-gray-100"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Domain include */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide mb-2 block">
                    Only these domains
                  </label>
                  <div className="flex gap-2">
                    <input
                      value={domainInput}
                      onChange={(e) => setDomainInput(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && addDomain("include")
                      }
                      placeholder="e.g. github.com"
                      className="nb-input !py-1.5 !px-3 !text-xs !border-2 !rounded-md flex-1"
                    />
                    <button
                      onClick={() => addDomain("include")}
                      className="nb-btn nb-btn-sm"
                    >
                      +
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {filters.domain_include.map((d) => (
                      <span
                        key={d}
                        className="nb-badge !bg-[var(--accent-teal)] !text-xs flex items-center gap-1"
                      >
                        {d}
                        <X
                          className="w-3 h-3 cursor-pointer"
                          onClick={() => removeDomain("include", d)}
                        />
                      </span>
                    ))}
                  </div>
                </div>

                {/* Domain exclude */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide mb-2 block">
                    Exclude domains
                  </label>
                  <div className="flex gap-2">
                    <input
                      value={excludeInput}
                      onChange={(e) => setExcludeInput(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && addDomain("exclude")
                      }
                      placeholder="e.g. pinterest.com"
                      className="nb-input !py-1.5 !px-3 !text-xs !border-2 !rounded-md flex-1"
                    />
                    <button
                      onClick={() => addDomain("exclude")}
                      className="nb-btn nb-btn-sm"
                    >
                      +
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {filters.domain_exclude.map((d) => (
                      <span
                        key={d}
                        className="nb-badge !bg-[var(--accent-coral)] !text-xs flex items-center gap-1"
                      >
                        {d}
                        <X
                          className="w-3 h-3 cursor-pointer"
                          onClick={() => removeDomain("exclude", d)}
                        />
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
