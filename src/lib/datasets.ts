/**
 * Bright Data Datasets API client.
 *
 * Provides historical baseline snapshots via the Web Scraper / Datasets API.
 * Trigger a collection for a set of SERP queries, then download the snapshot
 * and compare against live results.
 */

import {
  BaselineResult,
  BaselineSnapshot,
  BaselineDiff,
  RankedResult,
} from "./types";
import { canonicalizeUrl, extractDomain } from "./dedupe";

const DATASETS_API_BASE = "https://api.brightdata.com/datasets/v3";

function getApiToken(): string {
  const token = process.env.BRIGHT_DATA_API_TOKEN;
  if (!token) {
    throw new Error("BRIGHT_DATA_API_TOKEN is not set");
  }
  return token;
}

function getDatasetId(): string {
  const id = process.env.BRIGHT_DATA_DATASET_ID;
  if (!id) {
    throw new Error(
      "BRIGHT_DATA_DATASET_ID is not set. Create a SERP scraper in your Bright Data dashboard and add its dataset ID.",
    );
  }
  return id;
}

/**
 * Trigger a baseline collection for a set of search queries.
 *
 * Uses the Web Scraper API to collect SERP results and store them
 * as a snapshot that can be compared against live results later.
 *
 * @returns snapshot_id to use for polling and downloading
 */
export async function triggerBaseline(
  queries: string[],
  engine: "google" | "bing" = "google",
  geo: string = "us",
): Promise<{ snapshot_id: string }> {
  const token = getApiToken();
  const datasetId = getDatasetId();

  const inputs = queries.map((query) => {
    const q = encodeURIComponent(query);
    const url =
      engine === "bing"
        ? `https://www.bing.com/search?q=${q}&count=10&cc=${geo}`
        : `https://www.google.com/search?q=${q}&gl=${geo}&num=10`;
    return { url };
  });

  const res = await fetch(
    `${DATASETS_API_BASE}/trigger?dataset_id=${datasetId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(inputs),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Datasets API trigger error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return { snapshot_id: data.snapshot_id };
}

/**
 * Check the progress of a baseline collection.
 */
export async function checkBaselineProgress(
  snapshotId: string,
): Promise<{ status: string; progress?: number }> {
  const token = getApiToken();

  const res = await fetch(`${DATASETS_API_BASE}/progress/${snapshotId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Datasets API progress error ${res.status}: ${text}`);
  }

  return res.json();
}

/**
 * Download a completed baseline snapshot.
 */
export async function fetchBaselineSnapshot(
  snapshotId: string,
): Promise<BaselineSnapshot> {
  const token = getApiToken();

  const res = await fetch(
    `${DATASETS_API_BASE}/snapshot/${snapshotId}?format=json`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Datasets API snapshot error ${res.status}: ${text}`);
  }

  const rawData = await res.json();

  // Transform Datasets API response into our BaselineResult format
  const results: BaselineResult[] = [];

  // Datasets API returns an array of scraping results
  const items = Array.isArray(rawData) ? rawData : [rawData];

  for (const item of items) {
    // Each item can contain organic results from SERP scraping
    const organics = item.organic || item.results || [];
    for (const organic of Array.isArray(organics) ? organics : []) {
      const url = organic.link || organic.url || "";
      if (url) {
        results.push({
          title: organic.title || "",
          url,
          description: organic.description || organic.snippet || "",
          domain: extractDomain(url),
        });
      }
    }
  }

  return {
    snapshot_id: snapshotId,
    query: items[0]?.general?.query || items[0]?.input?.keyword || "",
    collected_at: items[0]?.timestamp || new Date().toISOString(),
    status: "ready",
    results,
  };
}

/**
 * Compare live search results against a baseline snapshot.
 *
 * Uses canonical URL matching to determine:
 * - new_sources: URLs in live results but not in baseline
 * - missing_sources: URLs in baseline but not in live results
 * - persistent_sources: URLs appearing in both
 */
export function compareBaseline(
  liveResults: RankedResult[],
  baseline: BaselineSnapshot,
): BaselineDiff {
  const baselineUrls = new Set(
    baseline.results.map((r) => canonicalizeUrl(r.url)),
  );
  const liveUrls = new Set(liveResults.map((r) => canonicalizeUrl(r.url)));

  const newSources = liveResults.filter(
    (r) => !baselineUrls.has(canonicalizeUrl(r.url)),
  );
  const missingSources = baseline.results.filter(
    (r) => !liveUrls.has(canonicalizeUrl(r.url)),
  );
  const persistentSources = liveResults.filter((r) =>
    baselineUrls.has(canonicalizeUrl(r.url)),
  );

  return {
    new_sources: newSources,
    missing_sources: missingSources,
    persistent_sources: persistentSources,
    baseline_total: baseline.results.length,
    live_total: liveResults.length,
    snapshot_id: baseline.snapshot_id,
    collected_at: baseline.collected_at,
  };
}
