import { canonicalizeUrl, extractDomain } from "./dedupe";
import type { RankedResult } from "./types";

const DATASETS_API_BASE = "https://api.brightdata.com/datasets/v3";

// Default: Bright Data's standard Google Search SERP dataset
const DEFAULT_DATASET_ID = "gd_l1viktl72bvl7bjuj0";

export interface BaselineResult {
  url: string;
  title: string;
  description: string;
  domain: string;
  canonical_url: string;
}

export interface BaselineData {
  query: string;
  geo: string;
  snapshot_id: string;
  collected_at: string; // ISO timestamp
  results: BaselineResult[];
}

export interface BaselineComparison {
  new_sources: BaselineResult[]; // in live but not in baseline
  gone_sources: BaselineResult[]; // in baseline but not in live
  persistent: BaselineResult[]; // in both
  baseline_date: string;
  baseline_count: number;
  live_count: number;
}

/**
 * Trigger a Datasets API collection for given queries.
 * Returns a snapshot_id to poll for results.
 */
export async function triggerBaseline(
  query: string,
  geo: string = "us",
): Promise<string> {
  const apiToken = process.env.BRIGHT_DATA_API_TOKEN;
  if (!apiToken) {
    throw new Error("BRIGHT_DATA_API_TOKEN is not set");
  }

  const datasetId = process.env.BRIGHT_DATA_DATASET_ID || DEFAULT_DATASET_ID;

  const res = await fetch(
    `${DATASETS_API_BASE}/trigger?dataset_id=${datasetId}&format=json`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        {
          url: `https://www.google.com/search?q=${encodeURIComponent(query)}&gl=${geo}&hl=en`,
        },
      ]),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Datasets API error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as { snapshot_id?: string };
  if (!data.snapshot_id) {
    throw new Error("Datasets API did not return a snapshot_id");
  }

  return data.snapshot_id;
}

/**
 * Fetch snapshot results. Returns null if still processing (HTTP 202).
 */
export async function fetchSnapshot(
  snapshotId: string,
): Promise<BaselineResult[] | null> {
  const apiToken = process.env.BRIGHT_DATA_API_TOKEN;
  if (!apiToken) {
    throw new Error("BRIGHT_DATA_API_TOKEN is not set");
  }

  const res = await fetch(
    `${DATASETS_API_BASE}/snapshot/${snapshotId}?format=json`,
    {
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
    },
  );

  // 202 = still processing
  if (res.status === 202) {
    return null;
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Snapshot fetch error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as Record<string, unknown>[];

  // Datasets API returns an array of result objects
  // Normalize to our BaselineResult format
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map(
    (item: Record<string, unknown>, index: number): BaselineResult => {
      const url =
        (item.url as string) ||
        (item.link as string) ||
        (item.final_url as string) ||
        "";
      const title =
        (item.title as string) ||
        (item.name as string) ||
        `Result ${index + 1}`;
      const description =
        (item.description as string) || (item.snippet as string) || "";

      return {
        url,
        title,
        description,
        domain: extractDomain(url),
        canonical_url: canonicalizeUrl(url),
      };
    },
  );
}

/**
 * Compare live search results against a stored baseline.
 * Uses canonical URLs for matching.
 */
export function compareBaseline(
  liveResults: RankedResult[],
  baseline: BaselineData,
): BaselineComparison {
  const liveUrls = new Set(liveResults.map((r) => canonicalizeUrl(r.url)));
  const baselineUrls = new Set(baseline.results.map((r) => r.canonical_url));

  const new_sources: BaselineResult[] = [];
  const persistent: BaselineResult[] = [];

  // Check live results against baseline
  for (const result of liveResults) {
    const canonical = canonicalizeUrl(result.url);
    const asBaseline: BaselineResult = {
      url: result.url,
      title: result.title,
      description: result.description,
      domain: result.domain,
      canonical_url: canonical,
    };

    if (baselineUrls.has(canonical)) {
      persistent.push(asBaseline);
    } else {
      new_sources.push(asBaseline);
    }
  }

  // Find gone sources (in baseline but not in live)
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

/**
 * Simple hash for query strings. Used as blob storage keys.
 */
export function hashQuery(query: string): string {
  let hash = 0;
  const str = query.toLowerCase().trim();
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash).toString(36);
}
