---
name: unfancy-serp-pipeline
description: "Build a SERP-powered search pipeline using Bright Data SERP API — query expansion, RRF reranking, deduplication, and domain clustering. No frontend required. Proves you don't need a fancy search API."
---

# Unfancy SERP Pipeline Skill

Build a complete search API backend from scratch: Bright Data SERP retrieval → optional LLM query expansion → RRF reranking → deduplication → domain clustering. Everything a "fancy search API" does, in ~300 lines of TypeScript.

## What This Skill Covers

- **Bright Data SERP API** integration (Google/Bing)
- **Query expansion** via Anthropic Claude (optional, toggled by caller)
- **Reciprocal Rank Fusion (RRF)** reranking across multiple sub-queries
- **URL canonicalization** and deduplication
- **Domain clustering** with diversity enforcement

## Architecture

```
User query
    │
    ├── [LLM expansion OFF] → single query
    │
    └── [LLM expansion ON] → Claude Haiku generates 3-12 sub-queries
            │
            ▼
    Bright Data SERP API (fan-out, parallel requests)
    Google + Bing, geo-targeted
            │
            ▼
    Deduplicate (canonical URL normalization)
            │
            ▼
    RRF Reranking (merge ranked lists across sub-queries)
            │
            ▼
    Domain Clustering + Diversity enforcement
            │
            ▼
    Structured JSON response
```

## Dependencies

Runtime (zero npm packages for the pipeline itself):

- `fetch` (built into Node 18+)
- TypeScript

External APIs:

- **Bright Data SERP API** — `https://api.brightdata.com/request` (required)
- **Anthropic API** — `https://api.anthropic.com/v1/messages` (optional, for LLM expansion)

## Environment Variables

```env
# Required
BRIGHT_DATA_API_TOKEN=your_bright_data_api_token
BRIGHT_DATA_SERP_ZONE=serp_api1

# Optional (for LLM query expansion)
ANTHROPIC_API_KEY=your_anthropic_api_key
```

## Type System

```typescript
// src/lib/types.ts

export interface SerpResult {
  title: string;
  url: string;
  description: string;
  position: number;
  source_engine: string;
  source_query: string;
}

export interface RankedResult extends SerpResult {
  rrf_score: number;
  query_coverage: number; // how many sub-queries returned this URL
  domain: string;
}

export interface DomainCluster {
  domain: string;
  count: number;
  results: RankedResult[];
}

export interface SearchMeta {
  total_serp_results: number;
  unique_after_dedup: number;
  queries_executed: number;
  engines_used: string[];
  geo: string;
  estimated_cost_usd: number;
  duration_ms: number;
}

export interface SearchResponse {
  query: string;
  expanded_queries: string[];
  results: RankedResult[];
  clusters: DomainCluster[];
  meta: SearchMeta;
}
```

## Module 1: Bright Data SERP Client

File: `src/lib/bright-data.ts`

Handles SERP retrieval via Bright Data's API. Supports Google and Bing with geo-targeting.

### Key Implementation Details

- **Google**: Uses `brd_json=1` URL parameter for parsed JSON. Format: `raw` (Bright Data returns the parsed JSON directly).
- **Bing**: Uses Bright Data's own `json` wrapper format. Field names differ (`link` vs `url`).
- **Google `num` parameter is dead since Sep 2025** — cannot control result count via URL. Bright Data parses whatever Google returns.
- **Fan-out**: Runs all queries × engines in parallel via `Promise.allSettled` (fault-tolerant).

### API Request Format

```typescript
const response = await fetch("https://api.brightdata.com/request", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.BRIGHT_DATA_API_TOKEN}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    zone: process.env.BRIGHT_DATA_SERP_ZONE || "serp_api1",
    url: searchUrl, // Full Google/Bing search URL
    format: engine === "google" ? "raw" : "json",
  }),
});
```

### URL Construction

```typescript
// Google (brd_json=1 tells Bright Data to parse HTML → JSON)
`https://www.google.com/search?q=${q}&gl=${country}&hl=en&pws=0&brd_json=1`
// Bing (count param works, cc for country)
`https://www.bing.com/search?q=${q}&count=${numResults}&cc=${country}&setlang=en`;
```

### Response Parsing

Google (`brd_json=1`) returns `{ organic: [{ url, title, description, position }] }`.
Bing (`format: json`) returns `{ organic: [{ link, title, snippet, rank }] }`.

Handle both field names:

```typescript
const url = item.url || item.link || "";
const description = item.description || item.snippet || "";
const position = item.position ?? item.rank ?? index + 1;
```

### Fan-out Function

```typescript
export async function fetchSerpFanOut(
  queries: string[],
  engines: ("google" | "bing")[],
  country: string,
  numResults: number,
): Promise<SerpResult[]> {
  const requests = queries.flatMap((query) =>
    engines.map((engine) =>
      fetchSerp({
        query,
        search_engine: engine,
        country,
        num_results: numResults,
      }),
    ),
  );

  const settled = await Promise.allSettled(requests);
  const allResults: SerpResult[] = [];

  for (const result of settled) {
    if (result.status === "fulfilled") {
      allResults.push(...result.value);
    } else {
      console.error("SERP request failed:", result.reason);
    }
  }

  return allResults;
}
```

## Module 2: Query Expansion (Optional)

File: `src/lib/query-expansion.ts`

Uses Anthropic Claude Haiku (claude-haiku-4-5) for fast, cheap query expansion. This module is **optional** — callers should check for expansion flag before invoking.

### Key Details

- Model: `claude-haiku-4-5` (~$0.00015 per expansion call)
- Direct `fetch` to Anthropic API (no SDK dependency)
- System prompt instructs neutral reformulations only — no invented facts
- Returns JSON array of strings, strips markdown code fences if present
- **Throws** if `ANTHROPIC_API_KEY` is not set — caller should check before calling

### Implementation Pattern

````typescript
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

export async function expandQuery(
  query: string,
  count: number = 5,
): Promise<string[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: 512,
      system: `You are a search query expansion engine. Given a user query, generate exactly ${count} diverse search queries that cover different phrasings, synonyms, and search intents — without adding any assumed facts, biographical details, or context not present in the original query. Return ONLY a JSON array of strings, no explanation.`,
      messages: [{ role: "user", content: query }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  const content = data.content?.[0]?.text || "[]";
  const cleaned = content.replace(/```(?:json)?\n?/g, "").trim();
  const queries = JSON.parse(cleaned);

  if (Array.isArray(queries) && queries.length > 0) {
    return queries.slice(0, count);
  }
  return [query];
}
````

## Module 3: URL Deduplication

File: `src/lib/dedupe.ts`

Canonicalizes URLs and extracts domains for deduplication.

### Canonicalization Rules

1. Lowercase hostname
2. Strip `www.` prefix
3. Remove tracking params: `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `ref`, `fbclid`, `gclid`, `msclkid`, `mc_cid`, `mc_eid`, `s_kwcid`, `_ga`, `ck_subscriber_id`
4. Sort remaining query parameters alphabetically
5. Remove trailing slashes (except root `/`)
6. Remove URL fragments (`#...`)
7. Preserve protocol (`https://`)

### Implementation Pattern

```typescript
const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "ref",
  "fbclid",
  "gclid",
  "msclkid",
  "mc_cid",
  "mc_eid",
  "s_kwcid",
  "_ga",
  "ck_subscriber_id",
]);

export function canonicalizeUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    url.hostname = url.hostname.toLowerCase();
    if (url.hostname.startsWith("www.")) {
      url.hostname = url.hostname.slice(4);
    }
    for (const param of TRACKING_PARAMS) {
      url.searchParams.delete(param);
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

export function extractDomain(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    let hostname = url.hostname.toLowerCase();
    if (hostname.startsWith("www.")) hostname = hostname.slice(4);
    return hostname;
  } catch {
    return rawUrl;
  }
}
```

## Module 4: RRF Reranking

File: `src/lib/rerank.ts`

Reciprocal Rank Fusion — merges multiple ranked result lists into one.

### Algorithm

```
RRF_score(url) = Σ 1/(k + rank + 1)   for each list containing the URL
k = 60 (standard constant from Cormack et al.)
```

Results appearing across MORE sub-queries get higher scores. This is the core "magic" that fancy search APIs sell.

### Implementation (15 lines)

```typescript
import { SerpResult, RankedResult } from "./types";
import { canonicalizeUrl, extractDomain } from "./dedupe";

export function reciprocalRankFusion(
  rankedLists: SerpResult[][],
  k: number = 60,
): RankedResult[] {
  const scores = new Map<string, number>();
  const coverage = new Map<string, Set<string>>();
  const items = new Map<string, SerpResult>();

  for (const list of rankedLists) {
    for (let rank = 0; rank < list.length; rank++) {
      const canonical = canonicalizeUrl(list[rank].url);
      scores.set(canonical, (scores.get(canonical) ?? 0) + 1 / (k + rank + 1));

      if (!coverage.has(canonical)) coverage.set(canonical, new Set());
      coverage.get(canonical)!.add(list[rank].source_query);

      if (!items.has(canonical)) items.set(canonical, list[rank]);
    }
  }

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([canonical, score]) => {
      const item = items.get(canonical)!;
      return {
        ...item,
        rrf_score: Math.round(score * 10000) / 10000,
        query_coverage: coverage.get(canonical)?.size ?? 0,
        domain: extractDomain(item.url),
      };
    });
}
```

## Module 5: Domain Clustering

File: `src/lib/cluster.ts`

Groups results by domain and enforces diversity.

### Two Functions

1. **`clusterByDomain(results)`** — Groups results by domain, sorts clusters by count descending, sorts within each cluster by RRF score.

2. **`applyDomainDiversity(results, maxPerDomain = 3)`** — Caps results per domain to prevent one site dominating. Simple sequential pass: count per domain, skip when limit hit.

```typescript
export function clusterByDomain(results: RankedResult[]): DomainCluster[] {
  const domainMap = new Map<string, RankedResult[]>();
  for (const result of results) {
    if (!domainMap.has(result.domain)) domainMap.set(result.domain, []);
    domainMap.get(result.domain)!.push(result);
  }

  return [...domainMap.entries()]
    .map(([domain, results]) => ({
      domain,
      count: results.length,
      results: results.sort((a, b) => b.rrf_score - a.rrf_score),
    }))
    .sort((a, b) => b.count - a.count);
}

export function applyDomainDiversity(
  results: RankedResult[],
  maxPerDomain: number = 3,
): RankedResult[] {
  const domainCounts = new Map<string, number>();
  const diverse: RankedResult[] = [];

  for (const result of results) {
    const count = domainCounts.get(result.domain) ?? 0;
    if (count < maxPerDomain) {
      diverse.push(result);
      domainCounts.set(result.domain, count + 1);
    }
  }
  return diverse;
}
```

## Orchestration — Putting It All Together

This is the full pipeline. Wire it into any server framework (Next.js Route Handler, Express, standalone script, etc.):

```typescript
import { expandQuery } from "./lib/query-expansion";
import { fetchSerpFanOut } from "./lib/bright-data";
import { reciprocalRankFusion } from "./lib/rerank";
import { clusterByDomain, applyDomainDiversity } from "./lib/cluster";
import type { SearchResponse } from "./lib/types";

const SERP_COST_PER_REQUEST = 0.0015;
const LLM_COST_PER_CALL = 0.00015;

interface PipelineOptions {
  query: string;
  engines?: ("google" | "bing")[];
  geo?: string;
  num_results?: number;
  llm_expansion?: boolean; // false = single query, true = LLM expansion
  research_mode?: boolean; // true = more sub-queries (12 vs 3)
  domain_include?: string[];
  domain_exclude?: string[];
}

export async function runSearchPipeline(
  opts: PipelineOptions,
): Promise<SearchResponse> {
  const start = Date.now();
  const engines = opts.engines ?? ["google"];
  const geo = opts.geo ?? "us";
  const numResults = Math.min(opts.num_results ?? 10, 10);

  // Step 1: Query expansion (optional)
  let expandedQueries: string[];
  if (opts.llm_expansion) {
    const count = opts.research_mode ? 12 : 3;
    expandedQueries = await expandQuery(opts.query, count);
  } else {
    expandedQueries = [opts.query];
  }

  // Step 2: SERP fan-out retrieval
  const rawResults = await fetchSerpFanOut(
    expandedQueries,
    engines,
    geo,
    numResults,
  );

  // Step 3: Group results by source query for RRF
  const queryGroups = new Map<string, typeof rawResults>();
  for (const result of rawResults) {
    const key = `${result.source_engine}:${result.source_query}`;
    if (!queryGroups.has(key)) queryGroups.set(key, []);
    queryGroups.get(key)!.push(result);
  }

  // Step 4: RRF reranking
  let ranked = reciprocalRankFusion([...queryGroups.values()]);

  // Step 5: Apply domain filters
  if (opts.domain_include?.length) {
    ranked = ranked.filter((r) =>
      opts.domain_include!.some((d) => r.domain.includes(d)),
    );
  }
  if (opts.domain_exclude?.length) {
    ranked = ranked.filter(
      (r) => !opts.domain_exclude!.some((d) => r.domain.includes(d)),
    );
  }

  // Step 6: Domain diversity + clustering
  const diverse = applyDomainDiversity(ranked);
  const clusters = clusterByDomain(diverse);

  // Step 7: Cost estimation
  const serpRequestCount = expandedQueries.length * engines.length;
  const estimatedCost =
    serpRequestCount * SERP_COST_PER_REQUEST +
    (opts.llm_expansion ? LLM_COST_PER_CALL : 0);

  return {
    query: opts.query,
    expanded_queries: expandedQueries,
    results: diverse,
    clusters,
    meta: {
      total_serp_results: rawResults.length,
      unique_after_dedup: ranked.length,
      queries_executed: serpRequestCount,
      engines_used: engines,
      geo,
      estimated_cost_usd: Math.round(estimatedCost * 100000) / 100000,
      duration_ms: Date.now() - start,
    },
  };
}
```

## Cost Breakdown

```
Per search (LLM expansion OFF):
  SERP retrieval: 1 query × 1 engine      → 1 × $0.0015 = $0.0015
  Total: ~$0.0015 per search

Per search (LLM expansion ON, normal mode):
  LLM expansion: 1 call                   → ~$0.00015
  SERP retrieval: 3 queries × 1 engine    → 3 × $0.0015 = $0.0045
  Total: ~$0.005 per search

Per search (LLM expansion ON, research mode):
  LLM expansion: 1 call                   → ~$0.0003
  SERP retrieval: 12 queries × 1 engine   → 12 × $0.0015 = $0.018
  Total: ~$0.018 per search
```

For comparison, "fancy" search APIs charge $0.007-$0.015 per query.

## Testing

Use vitest. Tests live alongside source files (`*.test.ts`).

```typescript
// rerank.test.ts
import { describe, it, expect } from "vitest";
import { reciprocalRankFusion } from "./rerank";
import type { SerpResult } from "./types";

describe("reciprocalRankFusion", () => {
  it("boosts URLs appearing in multiple lists", () => {
    const list1: SerpResult[] = [
      {
        title: "A",
        url: "https://example.com/a",
        description: "",
        position: 1,
        source_engine: "google",
        source_query: "q1",
      },
      {
        title: "B",
        url: "https://example.com/b",
        description: "",
        position: 2,
        source_engine: "google",
        source_query: "q1",
      },
    ];
    const list2: SerpResult[] = [
      {
        title: "B",
        url: "https://example.com/b",
        description: "",
        position: 1,
        source_engine: "google",
        source_query: "q2",
      },
      {
        title: "C",
        url: "https://example.com/c",
        description: "",
        position: 2,
        source_engine: "google",
        source_query: "q2",
      },
    ];

    const results = reciprocalRankFusion([list1, list2]);
    expect(results[0].url).toBe("https://example.com/b"); // appears in both lists
    expect(results[0].query_coverage).toBe(2);
    expect(results.length).toBe(3);
  });
});
```

## Troubleshooting

### "BRIGHT_DATA_API_TOKEN is not set"

- Set the env var. The SERP module reads `process.env.BRIGHT_DATA_API_TOKEN`.

### "SERP API error 403"

- Verify the API token is valid and the zone (`BRIGHT_DATA_SERP_ZONE`) exists in your Bright Data account.
- Ensure the zone has SERP permissions enabled.

### "ANTHROPIC_API_KEY is not set"

- This only fires when `llm_expansion` is true. Either set the key or keep expansion OFF.

### Empty results from Google

- Google's `num` parameter stopped working Sep 2025. You get whatever Google returns (~10 organic results). This is normal.
- Bing still supports `count` parameter.

### Results look identical across sub-queries

- This means query expansion is generating too-similar queries. Increase diversity in the system prompt or use more varied phrasing.

## Module 6: Datasets Baseline (Historical Comparison)

File: `src/lib/datasets.ts`

Uses the Bright Data Datasets API to collect a historical SERP snapshot, store it, and compare against live results.

### Environment Variables

```env
# Optional — for baseline comparison
# Default: gd_l1viktl72bvl7bjuj0 (standard Google Search SERP dataset)
BRIGHT_DATA_DATASET_ID=
```

### Datasets API Flow

1. **Trigger collection**: `POST https://api.brightdata.com/datasets/v3/trigger?dataset_id={id}&format=json`
   - Body: `[{keyword: "search query", country: "us", language: "en"}]`
   - Auth: `Authorization: Bearer {BRIGHT_DATA_API_TOKEN}` (same token as SERP)
   - Returns: `{snapshot_id: "s_xxx"}`

2. **Poll for results**: `GET https://api.brightdata.com/datasets/v3/snapshot/{snapshot_id}?format=json`
   - Returns HTTP 202 if still processing
   - Returns JSON array of results when ready

3. **Store baseline**: Save results in Netlify Blobs (`baselines` store, key: hash of query)

4. **Compare**: On future searches, load baseline and diff against live results by canonical URL

### Key Functions

```typescript
// Trigger a Datasets API collection
export async function triggerBaseline(
  query: string,
  geo: string,
): Promise<string>; // returns snapshot_id

// Fetch snapshot results (null = still processing)
export async function fetchSnapshot(
  snapshotId: string,
): Promise<BaselineResult[] | null>;

// Compare live results against baseline
export function compareBaseline(
  liveResults: RankedResult[],
  baseline: BaselineData,
): BaselineComparison;
// Returns { new_sources, gone_sources, persistent }
```

### BaselineComparison Types

```typescript
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
  collected_at: string; // ISO timestamp
  results: BaselineResult[];
}

interface BaselineComparison {
  new_sources: BaselineResult[]; // in live but not in baseline
  gone_sources: BaselineResult[]; // in baseline but not in live
  persistent: BaselineResult[]; // in both
  baseline_date: string;
  baseline_count: number;
  live_count: number;
}
```

### Background Function

File: `netlify/functions/baseline-background.mts`

Handles the async Datasets collection:

1. Receives `{query, geo, job_id}` from API route
2. Calls `triggerBaseline()` → gets snapshot_id
3. Polls `fetchSnapshot()` every 10s (max 5 min)
4. Stores baseline in `baselines` blob store
5. Updates job status in `baseline-jobs` blob store

### API Routes

- `POST /api/baseline` — Trigger new baseline collection (fire-and-forget to background function)
- `GET /api/baseline?query=xyz` — Get stored baseline for a query
- `GET /api/baseline-status/{id}` — Poll baseline job status

### Frontend Integration

The `useBaseline` hook (`src/hooks/use-baseline.ts`) manages:

- Checking for existing baseline on query change
- Triggering new collections
- Computing comparison when both baseline and live results exist
- Polling for collection completion

The `BaselineComparisonPanel` component shows in the sidebar:

- "Collect Baseline" button when no baseline exists
- Progress indicator during collection
- New/gone/persistent source comparison with expandable URL lists
- "Refresh" button to re-collect
- Note about periodic refresh capability
