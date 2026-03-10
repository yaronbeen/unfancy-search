---
name: unfancy-serp-pipeline
description: "Run unfancy search queries — asks user for a search term, runs the full pipeline (query expansion → SERP fan-out → RRF reranking → dedup → clustering), and displays formatted results."
---

# Unfancy Search Pipeline

Run search queries through the full unfancy pipeline: LLM query expansion → Bright Data SERP retrieval → Reciprocal Rank Fusion → deduplication → domain clustering.

## How to Use

### Step 1: Ask the user what to search for

Ask the user for their search query. Optionally ask if they want AI expansion enabled (off by default for speed).

### Step 2: Run the search

Hit the live API. Use `curl` or `fetch`:

```bash
# Basic search (no AI expansion — fast, single query)
curl -s -X POST https://unfancy-search.yaron-been.workers.dev/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "USER_QUERY_HERE", "engines": ["google"], "geo": "us", "num_results": 10, "llm_expansion": false}'
```

```bash
# With AI expansion (Claude Haiku generates 3 sub-queries, better coverage)
curl -s -X POST https://unfancy-search.yaron-been.workers.dev/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "USER_QUERY_HERE", "engines": ["google"], "geo": "us", "num_results": 10, "llm_expansion": true}'
```

```bash
# Research mode (12 sub-queries, maximum coverage)
curl -s -X POST https://unfancy-search.yaron-been.workers.dev/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "USER_QUERY_HERE", "engines": ["google"], "geo": "us", "num_results": 10, "llm_expansion": true, "research_mode": true}'
```

The POST returns a `job_id` immediately (search runs in background):

```json
{ "job_id": "abc-123", "status": "pending" }
```

### Step 3: Poll for results

```bash
curl -s https://unfancy-search.yaron-been.workers.dev/api/search-status/JOB_ID_HERE
```

Poll every 3 seconds. Response has `status: "pending" | "done" | "error"`.

When `status: "done"`, the `result` field contains:

```json
{
  "query": "best laptops for developers",
  "expanded_queries": ["best laptops for developers", "developer laptop 2024", "..."],
  "results": [
    {
      "title": "Page Title",
      "url": "https://example.com/page",
      "description": "Page description...",
      "rrf_score": 0.0323,
      "query_coverage": 3,
      "domain": "example.com"
    }
  ],
  "clusters": [
    { "domain": "example.com", "count": 2, "results": [...] }
  ],
  "meta": {
    "total_serp_results": 30,
    "unique_after_dedup": 24,
    "queries_executed": 3,
    "engines_used": ["google"],
    "geo": "us",
    "estimated_cost_usd": 0.005,
    "duration_ms": 4200
  }
}
```

### Step 4: Display results

Format the results for the user. Show:

1. **Results** — Numbered list with title, URL, description, and RRF score
2. **Meta** — How many raw results, unique after dedup, cost, duration
3. **Expanded queries** — What sub-queries were generated (if AI expansion was on)
4. **Domain clusters** — Which domains appeared most

Example output format:

```
Search: "best laptops for developers"
Expanded to 3 queries | 30 raw → 24 unique | $0.005 | 4.2s

 1. Best Developer Laptops 2024 — Wirecutter
    https://nytimes.com/wirecutter/reviews/best-laptops-developers
    RRF: 0.0323 | Found in 3/3 queries

 2. The 10 Best Programming Laptops — Tom's Hardware
    https://tomshardware.com/best-picks/best-laptops-programming
    RRF: 0.0298 | Found in 2/3 queries

...

Top domains: wirecutter.com (3), tomshardware.com (2), reddit.com (2)
```

## API Parameters Reference

| Parameter        | Type     | Default      | Description                                                      |
| ---------------- | -------- | ------------ | ---------------------------------------------------------------- |
| `query`          | string   | required     | Search query                                                     |
| `engines`        | string[] | `["google"]` | `["google"]` or `["google", "bing"]`                             |
| `geo`            | string   | `"us"`       | Country code for geo-targeting                                   |
| `num_results`    | number   | `10`         | Max results per engine (capped at 10)                            |
| `llm_expansion`  | boolean  | `false`      | Enable AI query expansion                                        |
| `research_mode`  | boolean  | `false`      | Use 12 sub-queries instead of 3 (requires `llm_expansion: true`) |
| `domain_include` | string[] | `[]`         | Only include results from these domains                          |
| `domain_exclude` | string[] | `[]`         | Exclude results from these domains                               |

## Running Locally

If the live API is down, run locally:

```bash
cd /root/unfancy-search   # or wherever the repo is cloned
cp .env.example .env      # fill in BRIGHT_DATA_API_TOKEN and BRIGHT_DATA_SERP_ZONE
pnpm install && pnpm dev
# Then use http://localhost:3000/api/search instead of the workers.dev URL
```

## Rate Limits

- **Search**: 10 requests per minute per IP
- **Baseline**: 3 requests per hour per IP

If you get HTTP 429, wait and retry.
