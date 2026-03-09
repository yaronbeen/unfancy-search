# You Don't Need a Fancy Search API.

**I know that sounds ridiculous.**

Every week there's a new "AI search API" charging $7-15 per thousand queries. They show you a slick dashboard, structured JSON responses, "neural search" — and you think, _"Yeah, I need that."_

You probably don't.

I built this to prove it.

---

## What This Is

A full-featured search engine with query expansion, SERP retrieval, deduplication, reranking, domain clustering, and filters.

The kind of thing you'd pay a "fancy" search API vendor for.

Except this one costs **$0.002–$0.005 per search** instead of $0.01–$0.05. And you own every line.

**[Live Demo →](https://unfancy-search.pages.dev)**

---

## The Dirty Secret of "AI Search APIs"

Here's what happens when you call a fancy search API:

```
1. Your query hits an LLM that rewrites it into sub-queries
2. Those sub-queries hit a SERP scraper (yes, Google — same as everyone)
3. Results get deduplicated and reranked
4. You get clean JSON back
```

That's it. That's the whole product.

There is no proprietary search index. No magical neural retrieval that can't be replicated. It's a pipeline. Four steps. Each one is a function you can write yourself.

The "moat" is marketing.

---

## What's Inside This Repo

| Layer                 | What it does                                          | File                          |
| --------------------- | ----------------------------------------------------- | ----------------------------- |
| **Query Expansion**   | LLM rewrites your query into diverse sub-queries      | `src/lib/query-expansion.ts`  |
| **SERP Retrieval**    | Search Google via Bright Data SERP API                | `src/lib/bright-data.ts`      |
| **Reranking (RRF)**   | Reciprocal Rank Fusion across all sub-query results   | `src/lib/rerank.ts`           |
| **Deduplication**     | Canonical URL normalization, tracking param stripping | `src/lib/dedupe.ts`           |
| **Domain Clustering** | Group results by domain, enforce diversity            | `src/lib/cluster.ts`          |
| **API Endpoint**      | Orchestrates the full pipeline                        | `src/app/api/search/route.ts` |

The reranking implementation is 15 lines of TypeScript. Fifteen. Go look at it.

---

## The Math That Should Make You Angry

|                            | This project  | Fancy API (low-end) | Fancy API (high-end) |
| -------------------------- | ------------- | ------------------- | -------------------- |
| **Cost per search**        | ~$0.002-0.005 | ~$0.01              | ~$0.05               |
| **Cost per 1K searches**   | ~$2-5         | ~$10                | ~$50                 |
| **You own the code**       | Yes           | No                  | No                   |
| **Vendor lock-in**         | None          | Yes                 | Yes                  |
| **Can customize pipeline** | Everything    | Nothing             | Nothing              |

The SERP retrieval (the actual hard part) costs $1.50 per 1,000 requests through [Bright Data](https://get.brightdata.com/1tndi4600b25). The query expansion is a single Claude Haiku call — pennies. The reranking is free because it runs in your own code.

You're paying vendors a 3-17x markup for a wrapper.

---

## Run It Yourself — 5 Minutes

### Prerequisites

- Node.js 18+
- A [Bright Data](https://get.brightdata.com/1tndi4600b25) account (SERP API access — you'll get extra credits when signing up through this link)
- An [Anthropic](https://console.anthropic.com) API key (for query expansion via Claude Haiku)

### Steps

```bash
git clone https://github.com/yaronbeen/unfancy-search.git
cd unfancy-search
pnpm install
cp .env.example .env
```

Fill in your keys:

```env
BRIGHT_DATA_API_TOKEN=your_token_here
BRIGHT_DATA_SERP_ZONE=serp_api1
ANTHROPIC_API_KEY=your_key_here
```

Run it:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Search for anything.

That's it. You now have a search API that does what the fancy ones do.

---

## Features

- **Google SERP retrieval** — Real Google results via [Bright Data SERP API](https://get.brightdata.com/1tndi4600b25), not a cached index
- **Query expansion** — Claude AI generates diverse sub-queries to cover more ground
- **Reciprocal Rank Fusion** — Results appearing across multiple sub-queries rank higher
- **Domain clustering** — See which domains dominate your results
- **Domain diversity** — No single source hijacks the top positions
- **Filters** — Include/exclude domains, choose geo, set result count
- **Research mode** — Deeper retrieval with 12 sub-queries instead of 5
- **Cost transparency** — Every search shows you exactly what it cost
- **URL sharing** — Share any search via `?q=` URL parameter
- **Async pipeline** — Background Functions handle long-running SERP calls (up to 90s)
- **Baseline comparison** — Store a historical snapshot via [Bright Data Datasets API](https://get.brightdata.com/1tndi4600b25), then see what's new, gone, or persistent across searches
- **AI expansion toggle** — Turn LLM query expansion on/off (off by default for raw SERP speed)

---

## How Reciprocal Rank Fusion Works

This is the part that makes "fancy" search APIs seem magical. It's not.

RRF takes multiple ranked lists (one per sub-query) and fuses them into a single ranking. Results that appear in more lists, at higher positions, score higher.

The formula:

```
RRF_score(doc) = Σ  1 / (k + rank)
                for each list containing doc
```

Where `k = 60` (standard constant from the original paper).

Here's the entire implementation:

```typescript
function rrf(rankedLists: SearchResult[][], k = 60): RankedResult[] {
  const scores = new Map<string, number>();
  const items = new Map<string, SearchResult>();

  for (const list of rankedLists) {
    for (let rank = 0; rank < list.length; rank++) {
      const url = canonicalize(list[rank].url);
      scores.set(url, (scores.get(url) ?? 0) + 1 / (k + rank + 1));
      items.set(url, list[rank]);
    }
  }

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([url]) => items.get(url)!);
}
```

That's it. 15 lines. This is what you're paying a markup for.

---

## Baseline Comparison (Datasets API)

Fancy search APIs don't give you historical comparison. This project does.

Click **"Collect Baseline"** in the sidebar after a search. The app triggers the [Bright Data Datasets API](https://get.brightdata.com/1tndi4600b25) to collect a SERP snapshot for your query. On future searches, it compares live results against the stored baseline:

- **New sources** — URLs appearing in live results but not in the baseline
- **Gone sources** — URLs that were in the baseline but have dropped out
- **Persistent** — URLs appearing in both

Refresh your baseline daily or weekly to track how search results evolve. Useful for SEO monitoring, competitive research, or any use case where result drift matters.

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx                     # Search UI + baseline comparison
│   ├── layout.tsx                   # Root layout + OG metadata
│   └── api/
│       ├── search/route.ts          # POST — dispatches search to background
│       ├── search-status/[jobId]/   # GET — polls for search results
│       ├── baseline/route.ts        # POST trigger + GET stored baseline
│       └── baseline-status/[id]/    # GET — polls for baseline collection
├── lib/
│   ├── bright-data.ts               # Bright Data SERP API client
│   ├── datasets.ts                  # Bright Data Datasets API + comparison
│   ├── query-expansion.ts           # Claude Haiku query expansion
│   ├── rerank.ts                    # Reciprocal Rank Fusion
│   ├── dedupe.ts                    # URL canonicalization
│   ├── cluster.ts                   # Domain clustering + diversity
│   └── types.ts                     # TypeScript types
├── components/
│   ├── baseline-comparison.tsx      # Baseline vs live comparison UI
│   └── ...                          # Search box, filters, results, etc.
└── hooks/
    ├── use-search.ts                # Search state management
    └── use-baseline.ts              # Baseline state + polling
open-next.config.ts                   # Cloudflare adapter config
wrangler.jsonc                         # Cloudflare Pages + KV config
```

---

## Tech Stack

- **Next.js 16** (App Router) + **TypeScript**
- **[Bright Data](https://get.brightdata.com/1tndi4600b25) SERP API** — retrieval backbone
- **Anthropic Claude Haiku** — query expansion
- **Tailwind CSS** + **Framer Motion** — UI styling and animations
- **Cloudflare Pages** (Free tier) — hosting with Workers + KV storage

---

## When SERP Isn't Enough

I'm not going to pretend this replaces everything.

If you need sub-200ms latency with a pre-built index — SERP scraping has inherent overhead. If you need full-page content extraction at scale — you'll want a scraper or unlocker on top. If you need a managed service and don't want to maintain code — pay the markup, that's fine.

But for most search features in most apps? Query expansion + SERP + reranking gets you 90% of the way. And you keep the other 90% of your money.

---

## Testing

This project has unit tests covering the entire pipeline:

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch
```

Tests cover:

- **URL canonicalization** — tracking param removal, www stripping, dedup logic
- **Reciprocal Rank Fusion** — score calculation, multi-list fusion, coverage tracking
- **Domain clustering** — grouping, sorting, diversity enforcement
- **Query expansion** — LLM integration (mocked)
- **SERP retrieval** — API client, error handling
- **API route** — full pipeline integration, filters, error responses

---

## Claude Code Skill

A Claude Code skill is included that enables Claude to generate this entire pipeline from scratch.

**Location:** [`.claude/skills/unfancy-search-pipeline/SKILL.md`](.claude/skills/unfancy-search-pipeline/SKILL.md)

The skill covers:

- Scaffolding the Next.js + TypeScript project
- Building all pipeline modules (types, query expansion, SERP client, dedupe, reranking, clustering)
- Wiring the `/api/search` route with async background processing
- Setting up Tailwind CSS + Framer Motion UI components
- Configuring vitest and writing tests
- Deploying to Cloudflare Pages with Workers + KV

To use it, copy the `.claude/skills/` directory into your project or `~/.claude/skills/` for global access. Then invoke `/unfancy-search-pipeline` in Claude Code.

---

## Disclaimer

Some links in this README are affiliate links. If you sign up for Bright Data through them, you may get extra credits on your account, and I may receive a small commission. This doesn't cost you anything extra - it helps support the project.

---

## License

MIT. Take it. Build on it. Ship it.

If this saved you from paying for a fancy search API, that's the whole point.
