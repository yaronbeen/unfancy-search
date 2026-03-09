"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { RankedResult } from "@/lib/types";

// Client-side types matching the server-side ones
interface BaselineResult {
  url: string;
  title: string;
  description: string;
  domain: string;
  canonical_url: string;
}

interface BaselineData {
  query: string;
  geo: string;
  snapshot_id: string;
  collected_at: string;
  results: BaselineResult[];
}

export interface BaselineComparison {
  new_sources: BaselineResult[];
  gone_sources: BaselineResult[];
  persistent: BaselineResult[];
  baseline_date: string;
  baseline_count: number;
  live_count: number;
}

function simpleHash(str: string): string {
  let hash = 0;
  const s = str.toLowerCase().trim();
  for (let i = 0; i < s.length; i++) {
    const char = s.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash).toString(36);
}

function canonicalizeUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    url.hostname = url.hostname.toLowerCase();
    if (url.hostname.startsWith("www.")) {
      url.hostname = url.hostname.slice(4);
    }
    // Remove common tracking params
    for (const p of [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "ref",
      "fbclid",
      "gclid",
      "msclkid",
    ]) {
      url.searchParams.delete(p);
    }
    url.searchParams.sort();
    let path = url.pathname;
    if (path.length > 1 && path.endsWith("/")) {
      path = path.slice(0, -1);
    }
    return `${url.protocol}//${url.hostname}${path}${url.search}`;
  } catch {
    return rawUrl.toLowerCase().replace(/\/$/, "");
  }
}

function extractDomain(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    let hostname = url.hostname.toLowerCase();
    if (hostname.startsWith("www.")) hostname = hostname.slice(4);
    return hostname;
  } catch {
    return rawUrl;
  }
}

function computeComparison(
  liveResults: RankedResult[],
  baseline: BaselineData,
): BaselineComparison {
  const liveUrls = new Set(liveResults.map((r) => canonicalizeUrl(r.url)));
  const baselineUrls = new Set(baseline.results.map((r) => r.canonical_url));

  const new_sources: BaselineResult[] = [];
  const persistent: BaselineResult[] = [];

  for (const result of liveResults) {
    const canonical = canonicalizeUrl(result.url);
    const asBaseline: BaselineResult = {
      url: result.url,
      title: result.title,
      description: result.description,
      domain: result.domain || extractDomain(result.url),
      canonical_url: canonical,
    };
    if (baselineUrls.has(canonical)) {
      persistent.push(asBaseline);
    } else {
      new_sources.push(asBaseline);
    }
  }

  const gone_sources = baseline.results.filter(
    (r) => !liveUrls.has(r.canonical_url),
  );

  return {
    new_sources,
    gone_sources,
    persistent,
    baseline_date: baseline.collected_at,
    baseline_count: baseline.results.length,
    live_count: liveResults.length,
  };
}

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export function useBaseline(query: string, liveResults: RankedResult[] | null) {
  const [baseline, setBaseline] = useState<BaselineData | null>(null);
  const [comparison, setComparison] = useState<BaselineComparison | null>(null);
  const [isCollecting, setIsCollecting] = useState(false);
  const [collectError, setCollectError] = useState<string | null>(null);
  const [baselineAge, setBaselineAge] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check for existing baseline when query changes
  useEffect(() => {
    if (!query.trim()) {
      setBaseline(null);
      setComparison(null);
      setBaselineAge(null);
      return;
    }

    let cancelled = false;

    async function checkBaseline() {
      try {
        const res = await fetch(
          `/api/baseline?query=${encodeURIComponent(query)}`,
        );
        const data = (await res.json()) as Record<string, unknown> & {
          exists?: boolean;
          baseline?: BaselineData;
        };
        if (cancelled) return;
        if (data.exists && data.baseline) {
          setBaseline(data.baseline);
          setBaselineAge(timeAgo(data.baseline.collected_at));
        } else {
          setBaseline(null);
          setBaselineAge(null);
        }
      } catch {
        if (!cancelled) {
          setBaseline(null);
          setBaselineAge(null);
        }
      }
    }

    checkBaseline();
    return () => {
      cancelled = true;
    };
  }, [query]);

  // Compute comparison when both baseline and live results exist
  useEffect(() => {
    if (baseline && liveResults && liveResults.length > 0) {
      setComparison(computeComparison(liveResults, baseline));
    } else {
      setComparison(null);
    }
  }, [baseline, liveResults]);

  // Update baseline age periodically
  useEffect(() => {
    if (!baseline) return;
    const interval = setInterval(() => {
      setBaselineAge(timeAgo(baseline.collected_at));
    }, 60_000);
    return () => clearInterval(interval);
  }, [baseline]);

  const collectBaseline = useCallback(
    async (turnstileToken?: string | null) => {
      if (!query.trim() || isCollecting) return;

      setIsCollecting(true);
      setCollectError(null);

      try {
        // Trigger baseline collection
        const triggerRes = await fetch("/api/baseline", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: query.trim(),
            geo: "us",
            turnstileToken: turnstileToken || undefined,
          }),
        });

        if (!triggerRes.ok) {
          const data = (await triggerRes.json().catch(() => ({}))) as Record<
            string,
            string
          >;
          throw new Error(data.error || "Failed to start baseline collection");
        }

        const { job_id } = (await triggerRes.json()) as { job_id: string };

        // Poll for results
        const deadline = Date.now() + 360_000; // 6 min client timeout

        if (pollRef.current) clearInterval(pollRef.current);

        await new Promise<void>((resolve, reject) => {
          pollRef.current = setInterval(async () => {
            if (Date.now() > deadline) {
              if (pollRef.current) clearInterval(pollRef.current);
              reject(new Error("Baseline collection timed out"));
              return;
            }

            try {
              const statusRes = await fetch(`/api/baseline-status/${job_id}`);
              const data = (await statusRes.json()) as Record<
                string,
                unknown
              > & {
                status?: string;
                baseline?: BaselineData;
                error?: string;
              };

              if (data.status === "done") {
                if (pollRef.current) clearInterval(pollRef.current);
                if (data.baseline) {
                  setBaseline(data.baseline);
                  setBaselineAge(timeAgo(data.baseline.collected_at));
                }
                resolve();
              } else if (data.status === "error") {
                if (pollRef.current) clearInterval(pollRef.current);
                reject(new Error(data.error || "Baseline collection failed"));
              }
            } catch {
              // Network error during poll — keep trying
            }
          }, 5_000);
        });
      } catch (err) {
        setCollectError(
          err instanceof Error ? err.message : "Baseline collection failed",
        );
      } finally {
        setIsCollecting(false);
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }
    },
    [query, isCollecting],
  );

  return {
    baseline,
    comparison,
    isCollecting,
    collectError,
    collectBaseline,
    baselineAge,
  };
}
