---
name: unfancy-search-pipeline
description: "Build a complete search API pipeline using Bright Data SERP API with query expansion, RRF reranking, deduplication, and domain clustering. Proves you don't need a fancy search API vendor."
---

# Unfancy Search Pipeline Skill

This skill provides a complete playbook for building a production-grade search API pipeline from scratch using Bright Data's SERP API, OpenAI for query expansion, and custom ranking algorithms.

## Project Structure

```
unfancy-search/
├── .env.example
├── .env.local (git-ignored)
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── search/
│   │   │       └── route.ts
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── SearchForm.tsx
│   │   ├── ResultsList.tsx
│   │   ├── ResultCard.tsx
│   │   ├── LoadingSpinner.tsx
│   │   └── ClusterView.tsx
│   └── lib/
│       ├── types.ts
│       ├── query-expansion.ts
│       ├── bright-data.ts
│       ├── dedupe.ts
│       ├── rerank.ts
│       ├── cluster.ts
│       └── datasets.ts
├── tests/
│   ├── rerank.test.ts
│   ├── dedupe.test.ts
│   └── cluster.test.ts
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── vitest.config.ts
└── next.config.js
```

## Step-by-Step Build Instructions

### Step 1: Scaffold Next.js Project with TypeScript

```bash
npx create-next-app@latest unfancy-search --typescript --tailwind --app
cd unfancy-search
```

Configure for App Router, TypeScript, Tailwind CSS, and ESLint.

### Step 2: Install Dependencies

```bash
npm install framer-motion lucide-react clsx
npm install -D vitest @testing-library/react @testing-library/jest-dom
```

Final dependencies:

- `next`, `react`, `react-dom` (from create-next-app)
- `framer-motion` (animations)
- `lucide-react` (icons)
- `clsx` (conditional classnames)
- `tailwindcss` (styling)
- `vitest` (testing)

### Step 3: Create Environment Configuration

Create `.env.example`:

```env
# Bright Data SERP API
BRIGHT_DATA_API_TOKEN=your_bright_data_api_token
BRIGHT_DATA_SERP_ZONE=serp_api1

# OpenAI (optional, for query expansion)
OPENAI_API_KEY=your_openai_api_key

# Datasets API (optional, for baseline comparison)
BRIGHT_DATA_DATASETS_ZONE=datasets_zone
```

Copy to `.env.local` and fill in actual values.

### Step 4: Define Type System (src/lib/types.ts)

```typescript
export interface SerpResult {
  url: string;
  title: string;
  description: string;
  position: number;
  source?: string;
}

export interface RankedResult extends SerpResult {
  rrf_score: number;
  query_coverage: number;
  domain: string;
  canonical_url: string;
}

export interface SearchRequest {
  query: string;
  num_results?: number;
  geo?: string;
  expand_query?: boolean;
}

export interface SearchResponse {
  query: string;
  expanded_queries?: string[];
  results: RankedResult[];
  clusters: DomainCluster[];
  meta: SearchMeta;
}

export interface DomainCluster {
  domain: string;
  count: number;
  results: RankedResult[];
}

export interface SearchMeta {
  total_results: number;
  processing_time_ms: number;
  serp_requests: number;
  cost_estimate: number;
  timestamp: string;
}
```

### Step 5: Implement Query Expansion (src/lib/query-expansion.ts)

```typescript
import { OpenAI } from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function expandQuery(query: string): Promise<string[]> {
  // Try LLM expansion first
  if (process.env.OPENAI_API_KEY) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "user",
            content: `Generate 3 alternative search queries that would find similar information to: "${query}". Return only the queries, one per line, no numbering.`,
          },
        ],
        temperature: 0.7,
        max_tokens: 100,
      });

      const text = response.choices[0].message.content || "";
      return text
        .split("\n")
        .map((q) => q.trim())
        .filter((q) => q.length > 0);
    } catch (error) {
      console.warn("OpenAI expansion failed, falling back to rules", error);
    }
  }

  // Rule-based fallback
  return generateRuleBasedExpansions(query);
}

function generateRuleBasedExpansions(query: string): string[] {
  const expansions: string[] = [];

  // Add quoted version
  expansions.push(`"${query}"`);

  // Add with common modifiers
  expansions.push(`${query} tutorial`);
  expansions.push(`${query} guide`);

  return expansions;
}
```

### Step 6: Implement Bright Data SERP Integration (src/lib/bright-data.ts)

```typescript
import { SerpResult } from "./types";

export async function fetchSerp(
  query: string,
  geo: string = "US",
  num: number = 10,
): Promise<SerpResult[]> {
  const response = await fetch("https://api.brightdata.com/request", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.BRIGHT_DATA_API_TOKEN}`,
    },
    body: JSON.stringify({
      zone: process.env.BRIGHT_DATA_SERP_ZONE || "serp_api1",
      url: `https://www.google.com/search?q=${encodeURIComponent(query)}&gl=${geo}&num=${num}`,
      format: "json",
    }),
  });

  if (!response.ok) {
    throw new Error(`Bright Data API error: ${response.statusText}`);
  }

  const data = await response.json();
  return parseGoogleResults(data);
}

export async function fetchSerpFanOut(
  queries: string[],
  geo: string = "US",
  num: number = 10,
): Promise<Map<string, SerpResult[]>> {
  const results = new Map<string, SerpResult[]>();

  for (const query of queries) {
    try {
      const serpResults = await fetchSerp(query, geo, num);
      results.set(query, serpResults);
    } catch (error) {
      console.error(`Failed to fetch SERP for query: ${query}`, error);
      results.set(query, []);
    }
  }

  return results;
}

function parseGoogleResults(data: any): SerpResult[] {
  // Parse Google SERP JSON response
  const results: SerpResult[] = [];

  if (data.organic_results) {
    data.organic_results.forEach((result: any, index: number) => {
      results.push({
        url: result.link,
        title: result.title,
        description: result.snippet,
        position: index + 1,
        source: "google",
      });
    });
  }

  return results;
}
```

### Step 7: Implement URL Deduplication (src/lib/dedupe.ts)

```typescript
export function canonicalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);

    // Remove www
    let hostname = parsed.hostname || "";
    if (hostname.startsWith("www.")) {
      hostname = hostname.slice(4);
    }

    // Remove fragment
    parsed.hash = "";

    // Remove tracking parameters
    const trackingParams = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_content",
      "utm_term",
      "fbclid",
      "gclid",
    ];
    trackingParams.forEach((param) => {
      parsed.searchParams.delete(param);
    });

    // Sort query parameters for consistency
    const params = new URLSearchParams(
      Array.from(parsed.searchParams.entries()).sort(),
    );

    // Remove trailing slash from pathname
    let pathname = parsed.pathname;
    if (pathname.endsWith("/") && pathname.length > 1) {
      pathname = pathname.slice(0, -1);
    }

    return `${hostname}${pathname}${params.toString() ? "?" + params.toString() : ""}`;
  } catch {
    return url.toLowerCase();
  }
}
```

### Step 8: Implement RRF Reranking (src/lib/rerank.ts)

```typescript
import { SerpResult, RankedResult } from "./types";
import { canonicalizeUrl } from "./dedupe";

const K = 60; // RRF constant

export function reciprocalRankFusion(
  rankedLists: SerpResult[][],
): RankedResult[] {
  const scores = new Map<string, number>();
  const urlToResult = new Map<string, SerpResult>();
  const queryCoverage = new Map<string, number>();

  // Calculate RRF scores
  for (const list of rankedLists) {
    for (let rank = 0; rank < list.length; rank++) {
      const canonical = canonicalizeUrl(list[rank].url);
      const score = 1 / (K + rank + 1);

      scores.set(canonical, (scores.get(canonical) ?? 0) + score);
      queryCoverage.set(canonical, (queryCoverage.get(canonical) ?? 0) + 1);

      if (!urlToResult.has(canonical)) {
        urlToResult.set(canonical, list[rank]);
      }
    }
  }

  // Convert to ranked results
  const results: RankedResult[] = Array.from(scores.entries())
    .map(([canonical, score]) => {
      const original = urlToResult.get(canonical)!;
      return {
        ...original,
        rrf_score: score,
        query_coverage: queryCoverage.get(canonical) ?? 0,
        domain: new URL(original.url).hostname || "",
        canonical_url: canonical,
      };
    })
    .sort((a, b) => b.rrf_score - a.rrf_score);

  return results;
}
```

### Step 9: Implement Domain Clustering (src/lib/cluster.ts)

```typescript
import { RankedResult, DomainCluster } from "./types";

export function clusterByDomain(results: RankedResult[]): DomainCluster[] {
  const clusters = new Map<string, RankedResult[]>();

  for (const result of results) {
    const domain = result.domain;
    if (!clusters.has(domain)) {
      clusters.set(domain, []);
    }
    clusters.get(domain)!.push(result);
  }

  return Array.from(clusters.entries()).map(([domain, results]) => ({
    domain,
    count: results.length,
    results,
  }));
}

export function applyDomainDiversity(
  results: RankedResult[],
  maxPerDomain: number = 3,
): RankedResult[] {
  const domainCounts = new Map<string, number>();
  const filtered: RankedResult[] = [];

  for (const result of results) {
    const domain = result.domain;
    const count = domainCounts.get(domain) ?? 0;

    if (count < maxPerDomain) {
      filtered.push(result);
      domainCounts.set(domain, count + 1);
    }
  }

  return filtered;
}
```

### Step 10: Implement Search API Route (src/app/api/search/route.ts)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { expandQuery } from "@/lib/query-expansion";
import { fetchSerpFanOut } from "@/lib/bright-data";
import { reciprocalRankFusion } from "@/lib/rerank";
import { applyDomainDiversity, clusterByDomain } from "@/lib/cluster";
import { SearchRequest, SearchResponse } from "@/lib/types";

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body: SearchRequest = await request.json();
    const { query, num_results = 10, geo = "US", expand_query = true } = body;

    if (!query || query.trim().length === 0) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    // Step 1: Expand query
    let queries = [query];
    let expandedQueries: string[] = [];

    if (expand_query) {
      try {
        expandedQueries = await expandQuery(query);
        queries = [query, ...expandedQueries];
      } catch (error) {
        console.warn("Query expansion failed, using original query", error);
      }
    }

    // Step 2: Fetch SERP results for all queries
    const serpResults = await fetchSerpFanOut(queries, geo, num_results);
    const rankedLists = Array.from(serpResults.values());

    // Step 3: Apply RRF reranking
    const rrfResults = reciprocalRankFusion(rankedLists);

    // Step 4: Apply domain diversity
    const diverseResults = applyDomainDiversity(rrfResults, 3);

    // Step 5: Cluster by domain
    const clusters = clusterByDomain(diverseResults);

    // Step 6: Build response
    const response: SearchResponse = {
      query,
      expanded_queries: expandedQueries,
      results: diverseResults.slice(0, num_results),
      clusters,
      meta: {
        total_results: diverseResults.length,
        processing_time_ms: Date.now() - startTime,
        serp_requests: queries.length,
        cost_estimate: queries.length * 0.001, // Rough estimate
        timestamp: new Date().toISOString(),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Search API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
```

### Step 11: Implement Datasets API Integration (src/lib/datasets.ts)

```typescript
export async function fetchBaseline(
  datasetId: string,
): Promise<Record<string, any>> {
  const response = await fetch(
    "https://api.brightdata.com/datasets/v3/trigger",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.BRIGHT_DATA_API_TOKEN}`,
      },
      body: JSON.stringify({
        dataset_id: datasetId,
        push_to_resource: false,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Datasets API trigger failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data;
}

export async function compareBaseline(
  snapshotId: string,
): Promise<Record<string, any>> {
  const response = await fetch(
    `https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.BRIGHT_DATA_API_TOKEN}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Datasets API snapshot failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data;
}
```

### Step 12: Build UI Components

#### src/components/SearchForm.tsx

```typescript
"use client";

import { useState } from "react";
import { Search } from "lucide-react";

interface SearchFormProps {
  onSearch: (query: string) => void;
  isLoading: boolean;
}

export function SearchForm({ onSearch, isLoading }: SearchFormProps) {
  const [query, setQuery] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the web..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          <Search size={20} />
          Search
        </button>
      </div>
    </form>
  );
}
```

#### src/components/ResultCard.tsx

```typescript
"use client";

import { RankedResult } from "@/lib/types";
import { ExternalLink } from "lucide-react";

interface ResultCardProps {
  result: RankedResult;
}

export function ResultCard({ result }: ResultCardProps) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1">
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline font-semibold"
          >
            {result.title}
          </a>
          <p className="text-sm text-gray-600 mt-1">{result.url}</p>
          <p className="text-gray-700 mt-2">{result.description}</p>
        </div>
        <a
          href={result.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-400 hover:text-gray-600"
        >
          <ExternalLink size={20} />
        </a>
      </div>
      <div className="flex gap-4 mt-3 text-xs text-gray-500">
        <span>RRF: {result.rrf_score.toFixed(3)}</span>
        <span>Coverage: {result.query_coverage}</span>
        <span>{result.domain}</span>
      </div>
    </div>
  );
}
```

#### src/components/ResultsList.tsx

```typescript
"use client";

import { RankedResult } from "@/lib/types";
import { ResultCard } from "./ResultCard";

interface ResultsListProps {
  results: RankedResult[];
}

export function ResultsList({ results }: ResultsListProps) {
  if (results.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No results found. Try a different search.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {results.map((result) => (
        <ResultCard key={result.canonical_url} result={result} />
      ))}
    </div>
  );
}
```

#### src/components/LoadingSpinner.tsx

```typescript
"use client";

import { motion } from "framer-motion";

export function LoadingSpinner() {
  return (
    <div className="flex justify-center items-center py-12">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full"
      />
    </div>
  );
}
```

#### src/components/ClusterView.tsx

```typescript
"use client";

import { DomainCluster } from "@/lib/types";

interface ClusterViewProps {
  clusters: DomainCluster[];
}

export function ClusterView({ clusters }: ClusterViewProps) {
  return (
    <div className="mt-8 p-4 bg-gray-50 rounded-lg">
      <h3 className="font-semibold mb-4">Results by Domain</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {clusters.map((cluster) => (
          <div key={cluster.domain} className="bg-white p-3 rounded border">
            <p className="font-medium text-sm">{cluster.domain}</p>
            <p className="text-xs text-gray-500">{cluster.count} results</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Step 13: Create Main Page (src/app/page.tsx)

```typescript
"use client";

import { useState } from "react";
import { SearchForm } from "@/components/SearchForm";
import { ResultsList } from "@/components/ResultsList";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ClusterView } from "@/components/ClusterView";
import { SearchResponse } from "@/lib/types";

export default function Home() {
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (query: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, expand_query: true }),
      });

      if (!res.ok) {
        throw new Error("Search failed");
      }

      const data = await res.json();
      setResponse(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold text-center mb-2">Unfancy Search</h1>
        <p className="text-center text-gray-600 mb-8">
          A search API that proves you don't need a fancy vendor
        </p>

        <SearchForm onSearch={handleSearch} isLoading={isLoading} />

        {isLoading && <LoadingSpinner />}

        {error && (
          <div className="mt-8 p-4 bg-red-50 border border-red-200 rounded text-red-700">
            {error}
          </div>
        )}

        {response && (
          <div className="mt-8">
            <div className="mb-6 p-4 bg-blue-50 rounded">
              <p className="text-sm text-gray-600">
                Query: <span className="font-semibold">{response.query}</span>
              </p>
              {response.expanded_queries && response.expanded_queries.length > 0 && (
                <p className="text-sm text-gray-600 mt-2">
                  Expanded to: {response.expanded_queries.join(", ")}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-2">
                {response.meta.serp_requests} SERP requests in{" "}
                {response.meta.processing_time_ms}ms
              </p>
            </div>

            <ResultsList results={response.results} />
            <ClusterView clusters={response.clusters} />
          </div>
        )}
      </div>
    </main>
  );
}
```

### Step 14: Set Up Testing (vitest.config.ts)

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: [],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

Create test files:

#### tests/dedupe.test.ts

```typescript
import { describe, it, expect } from "vitest";
import { canonicalizeUrl } from "@/lib/dedupe";

describe("canonicalizeUrl", () => {
  it("removes www prefix", () => {
    expect(canonicalizeUrl("https://www.example.com/page")).toBe(
      "example.com/page",
    );
  });

  it("removes tracking parameters", () => {
    const url =
      "https://example.com/page?utm_source=google&utm_medium=cpc&id=123";
    const canonical = canonicalizeUrl(url);
    expect(canonical).toContain("id=123");
    expect(canonical).not.toContain("utm_source");
  });

  it("removes fragments", () => {
    expect(canonicalizeUrl("https://example.com/page#section")).not.toContain(
      "#",
    );
  });

  it("removes trailing slashes", () => {
    expect(canonicalizeUrl("https://example.com/page/")).toBe(
      "example.com/page",
    );
  });
});
```

#### tests/rerank.test.ts

```typescript
import { describe, it, expect } from "vitest";
import { reciprocalRankFusion } from "@/lib/rerank";
import { SerpResult } from "@/lib/types";

describe("reciprocalRankFusion", () => {
  it("combines multiple ranked lists", () => {
    const list1: SerpResult[] = [
      {
        url: "https://example.com/a",
        title: "A",
        description: "Desc A",
        position: 1,
      },
      {
        url: "https://example.com/b",
        title: "B",
        description: "Desc B",
        position: 2,
      },
    ];

    const list2: SerpResult[] = [
      {
        url: "https://example.com/b",
        title: "B",
        description: "Desc B",
        position: 1,
      },
      {
        url: "https://example.com/c",
        title: "C",
        description: "Desc C",
        position: 2,
      },
    ];

    const results = reciprocalRankFusion([list1, list2]);

    expect(results.length).toBe(3);
    expect(results[0].canonical_url).toContain("example.com/b");
    expect(results[0].query_coverage).toBe(2);
  });
});
```

#### tests/cluster.test.ts

```typescript
import { describe, it, expect } from "vitest";
import { clusterByDomain, applyDomainDiversity } from "@/lib/cluster";
import { RankedResult } from "@/lib/types";

describe("clusterByDomain", () => {
  it("groups results by domain", () => {
    const results: RankedResult[] = [
      {
        url: "https://example.com/a",
        title: "A",
        description: "Desc",
        position: 1,
        rrf_score: 0.5,
        query_coverage: 1,
        domain: "example.com",
        canonical_url: "example.com/a",
      },
      {
        url: "https://other.com/b",
        title: "B",
        description: "Desc",
        position: 2,
        rrf_score: 0.4,
        query_coverage: 1,
        domain: "other.com",
        canonical_url: "other.com/b",
      },
    ];

    const clusters = clusterByDomain(results);
    expect(clusters.length).toBe(2);
    expect(clusters[0].count).toBe(1);
  });
});

describe("applyDomainDiversity", () => {
  it("limits results per domain", () => {
    const results: RankedResult[] = Array.from({ length: 6 }, (_, i) => ({
      url: `https://example.com/${i}`,
      title: `Result ${i}`,
      description: "Desc",
      position: i + 1,
      rrf_score: 0.5 - i * 0.05,
      query_coverage: 1,
      domain: "example.com",
      canonical_url: `example.com/${i}`,
    }));

    const filtered = applyDomainDiversity(results, 3);
    expect(filtered.length).toBe(3);
  });
});
```

### Step 15: Configure Build Tools

#### tailwind.config.js

```javascript
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

#### next.config.js

```javascript
module.exports = {
  reactStrictMode: true,
};
```

### Step 16: Run and Test

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your Bright Data API token

# Run tests
npm run test

# Start development server
npm run dev

# Visit http://localhost:3000
```

### Step 17: Deploy

#### Option A: Vercel

```bash
npm install -g vercel
vercel
```

#### Option B: Netlify

```bash
npm install -g netlify-cli
netlify deploy
```

## Key Algorithms Reference

### RRF Formula

```
score(url) = Σ 1/(k + rank + 1)
where k = 60 (constant)
```

For each ranked list, add 1/(60 + rank + 1) to the URL's score. Higher scores rank first.

### URL Canonicalization

1. Remove www prefix
2. Remove tracking parameters (utm\_\*, fbclid, gclid)
3. Remove URL fragments (#)
4. Remove trailing slashes
5. Sort query parameters alphabetically

### Domain Diversity

Apply after RRF: limit to 3 results per domain to ensure variety.

## API Endpoints

### POST /api/search

Request:

```json
{
  "query": "machine learning",
  "num_results": 10,
  "geo": "US",
  "expand_query": true
}
```

Response:

```json
{
  "query": "machine learning",
  "expanded_queries": ["machine learning tutorial", "machine learning guide"],
  "results": [
    {
      "url": "https://example.com/ml",
      "title": "ML Guide",
      "description": "...",
      "position": 1,
      "rrf_score": 0.85,
      "query_coverage": 2,
      "domain": "example.com",
      "canonical_url": "example.com/ml"
    }
  ],
  "clusters": [
    {
      "domain": "example.com",
      "count": 2,
      "results": [...]
    }
  ],
  "meta": {
    "total_results": 15,
    "processing_time_ms": 1250,
    "serp_requests": 3,
    "cost_estimate": 0.003,
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

## Bright Data API Integration

### SERP API Request Format

```typescript
const response = await fetch("https://api.brightdata.com/request", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.BRIGHT_DATA_API_TOKEN}`,
  },
  body: JSON.stringify({
    zone: process.env.BRIGHT_DATA_SERP_ZONE || "serp_api1",
    url: `https://www.google.com/search?q=${encodeURIComponent(query)}&gl=${geo}&num=${num}`,
    format: "json",
  }),
});
```

### Datasets API Format

Trigger collection:

```
POST https://api.brightdata.com/datasets/v3/trigger
Authorization: Bearer {token}
Content-Type: application/json

{
  "dataset_id": "dataset_id",
  "push_to_resource": false
}
```

Download snapshot:

```
GET https://api.brightdata.com/datasets/v3/snapshot/{snapshot_id}
Authorization: Bearer {token}
```

## Performance Optimization Tips

1. **Cache SERP results** in Redis for 24 hours
2. **Batch query expansion** to reduce OpenAI API calls
3. **Implement request deduplication** at the API layer
4. **Use CDN for static assets** (Vercel/Netlify handles this)
5. **Monitor Bright Data costs** — track requests per query
6. **Implement rate limiting** on /api/search endpoint

## Troubleshooting

### "Bright Data API error"

- Verify BRIGHT_DATA_API_TOKEN is set
- Check zone name matches your Bright Data account
- Ensure API token has SERP permissions

### "OpenAI expansion failed"

- Check OPENAI_API_KEY is set (optional, falls back to rules)
- Verify API key has chat.completions permission

### "No results found"

- Try a different query
- Check internet connectivity
- Verify Bright Data zone is active

## Next Steps

1. Add caching layer (Redis)
2. Implement analytics dashboard
3. Add advanced filters (date, domain, language)
4. Build CLI tool for batch searches
5. Create comparison mode (vs. Google, vs. Bing)
6. Add custom ranking weights
7. Implement A/B testing framework
