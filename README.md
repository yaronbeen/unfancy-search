# You Don't Need a Fancy Search API.

**I know that sounds ridiculous.**

Every week there's a new "AI search API" charging $7-15 per thousand queries. They show you a slick dashboard, structured JSON responses, "neural search" — and you think, _"Yeah, I need that."_

You probably don't.

I built this to prove it.

---

## What This Is

A full-featured search engine with query expansion, multi-engine retrieval, deduplication, reranking, domain clustering, and filters.

The kind of thing you'd pay a "fancy" search API vendor for.

Except this one costs **$0.008 per search** instead of $0.05. And you own every line.

**[Live Demo →](https://unfancy-search.netlify.app)**

---

## The Dirty Secret of "AI Search APIs"

Here's what happens when you call a fancy search API:

```
1. Your query hits an LLM that rewrites it into 5-10 sub-queries
2. Those sub-queries hit a SERP scraper (yes, Google/Bing — same as everyone)
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
| **SERP Retrieval**    | Fan-out search across Google + Bing via Bright Data   | `src/lib/bright-data.ts`      |
| **Reranking (RRF)**   | Reciprocal Rank Fusion across all sub-query results   | `src/lib/rerank.ts`           |
| **Deduplication**     | Canonical URL normalization, tracking param stripping | `src/lib/dedupe.ts`           |
| **Domain Clustering** | Group results by domain, enforce diversity            | `src/lib/cluster.ts`          |
| **API Endpoint**      | Orchestrates the full pipeline                        | `src/app/api/search/route.ts` |

The reranking implementation is 15 lines of TypeScript. Fifteen. Go look at it.

---

## The Math That Should Make You Angry

|                            | This project | Exa     | Tavily   |
| -------------------------- | ------------ | ------- | -------- |
| **Cost per search**        | ~$0.008      | ~$0.035 | ~$0.008+ |
| **Cost per 1K searches**   | ~$8          | ~$35    | ~$32     |
| **You own the code**       | Yes          | No      | No       |
| **Vendor lock-in**         | None         | Yes     | Yes      |
| **Can customize pipeline** | Everything   | Nothing | Nothing  |

The SERP retrieval (the actual hard part) costs $1.50 per 1,000 requests through Bright Data. The query expansion is a single LLM call — pennies. The reranking is free because it runs in your own code.

You're paying vendors a 4-5x markup for a wrapper.

---

## Run It Yourself — 5 Minutes

### Prerequisites

- Node.js 18+
- A [Bright Data](https://brightdata.com) account (SERP API access)
- An [OpenAI](https://platform.openai.com) API key (optional — rule-based expansion works without it)

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
OPENAI_API_KEY=your_key_here
```

Run it:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Search for anything.

That's it. You now have a search API that does what the fancy ones do.

---

## Features

- **Multi-engine search** — Google, Bing, or both simultaneously
- **Query expansion** — LLM generates diverse sub-queries to cover more ground
- **Reciprocal Rank Fusion** — Results appearing across multiple sub-queries rank higher
- **Domain clustering** — See which domains dominate your results
- **Domain diversity** — No single source hijacks the top positions
- **Filters** — Include/exclude domains, pick engines, choose geo, set result count
- **Research mode** — Deeper retrieval with 12 sub-queries instead of 5
- **Cost transparency** — Every search shows you exactly what it cost

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

That's it. 15 lines. This is what you're paying a 4x markup for.

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx                     # Search UI
│   ├── layout.tsx                   # Root layout
│   └── api/
│       └── search/
│           └── route.ts             # POST /api/search — full pipeline
├── lib/
│   ├── bright-data.ts               # SERP API client
│   ├── query-expansion.ts           # LLM query expansion
│   ├── rerank.ts                    # Reciprocal Rank Fusion
│   ├── dedupe.ts                    # URL canonicalization
│   ├── cluster.ts                   # Domain clustering + diversity
│   └── types.ts                     # TypeScript types
├── components/                      # UI components
└── hooks/                           # React hooks
```

---

## When SERP Isn't Enough

I'm not going to pretend this replaces everything.

If you need sub-200ms latency with a pre-built index — SERP scraping has inherent overhead. If you need full-page content extraction at scale — you'll want a scraper or unlocker on top. If you need a managed service and don't want to maintain code — pay the markup, that's fine.

But for most search features in most apps? Query expansion + SERP + reranking gets you 90% of the way. And you keep the other 90% of your money.

---

## Tech Stack

- **Next.js 16** (App Router) + **TypeScript**
- **Bright Data SERP API** — retrieval backbone
- **OpenAI GPT-4o-mini** — query expansion
- **Tailwind CSS** — styling
- **Deployed on Netlify**

---

## License

MIT. Take it. Build on it. Ship it.

If this saved you from paying for a fancy search API, that's the whole point.

---

## Testing

This project has comprehensive unit tests covering the entire pipeline:

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
- **Query expansion** — rule-based fallback, LLM integration (mocked)
- **SERP retrieval** — API client, fan-out execution, error handling
- **API route** — full pipeline integration, filters, error responses
