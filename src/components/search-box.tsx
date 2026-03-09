"use client";

import { motion } from "framer-motion";
import { Search, Loader2 } from "lucide-react";
import { useRef, useEffect } from "react";

interface SearchBoxProps {
  query: string;
  onQueryChange: (q: string) => void;
  onSearch: () => void;
  isSearching: boolean;
  hasResults: boolean;
}

export function SearchBox({
  query,
  onQueryChange,
  onSearch,
  isSearching,
  hasResults,
}: SearchBoxProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isSearching) {
      onSearch();
    }
  };

  return (
    <motion.div
      layout
      className="w-full max-w-2xl mx-auto"
      animate={{
        y: hasResults ? 0 : 0,
      }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <div className="relative">
        <motion.div className="relative" whileTap={{ scale: 0.995 }}>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search anything..."
            className="nb-input !pr-28 !py-4 !text-lg font-medium"
            disabled={isSearching}
          />
          <motion.button
            onClick={onSearch}
            disabled={isSearching || !query.trim()}
            className="nb-btn nb-btn-primary absolute right-2 top-1/2 -translate-y-1/2 !py-2.5 !px-5"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
          >
            {isSearching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>Search</span>
              </>
            )}
          </motion.button>
        </motion.div>
      </div>
    </motion.div>
  );
}
