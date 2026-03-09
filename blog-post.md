# You Don't Need a Fancy Search API

I spent three hours last month looking at "AI search API" pricing pages.

Exa. Tavily. Perplexity API. A handful of others. They all have the same pitch: structured JSON, neural retrieval, query understanding, developer-friendly. Prices range from $7 to $15 per thousand queries. Some charge per "credit" with multipliers that make the math deliberately hard to follow.

I kept thinking: what are they actually doing?

So I built the same thing myself. It took a weekend. It costs $0.008 per search instead of $0.035. And I own every line of it.

This post is about what I built, how it works, and why you probably don't need a fancy search API either.

---

## What a "Fancy Search API" Actually Is

Here is the dirty secret. When you call one of these fancy search APIs, here is what happens on their end:

1. Your query hits an LLM that rewrites it into 5-10 sub-queries
2. Those sub-queries hit a SERP scraper (Google, Bing, same as everyone)
3. Results get deduplicated and reranked
4. You get clean JSON back

That is the whole product. Four steps. Each one is a function you can write yourself.

There is no proprietary search index. No magical neural retrieval that cannot be replicated. The "moat" is marketing and the convenience of not having to assemble the pipeline yourself.

The retrieval step, which is the actually hard part, is just SERP scraping. They are all using the same underlying data source. The difference is how much markup they charge for wrapping it.

---

## What I Built

The project is called Unfancy Search. It is a Next.js app that implements the full pipeline explicitly, so you can see every step.

**[Live demo](https://unfancy-search.netlify.app) | [GitHub](https://github.com/yaronbeen/unfancy-search)**

Here is how it works:

### Step 1: Query Expansion

Given a user query like "best laptops for developers", the app generates 5-12 sub-queries using OpenAI GPT-4o-mini. Something like:

- "best laptops for software engineers 2024"
- "developer laptop recommendations Linux"
- "MacBook vs ThinkPad for programming"
- "high RAM laptop for coding"

If you do not have an OpenAI key, a rule-based fallback generates variations automatically. The LLM version is better but the fallback works fine for most queries.

### Step 2: SERP Fan-Out via Bright Data

Each sub-query hits the Bright Data SERP API. The app fans out across Google and Bing simultaneously, collecting raw results for every sub-query.

```typescript
const res = await fetch("https://api.brightdata.com/request", {
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

That is the entire retrieval layer. One POST request per sub-query. Bright Data handles the proxies, CAPTCHAs, and parsing. You get structured JSON back.

### Step 3: Reciprocal Rank Fusion

Now you have 5-12 ranked lists of results, one per sub-query. You need to blend them into a single ranking.

This is where fancy search APIs seem magical. It is not.

Reciprocal Rank Fusion (RRF) takes multiple ranked lists and fuses them. Results appearing in more lists, at higher positions, score higher. The formula is simple:

```
RRF_score(doc) = sum of 1 / (k + rank) for each list containing doc
```

Where k = 60 (standard constant from the original paper).

Here is the entire implementation:

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

Fifteen lines. This is what you are paying a 4x markup for.

### Step 4: Deduplication and Domain Diversity

Before returning results, the app canonicalizes URLs (strips tracking params, normalizes www, removes trailing slashes) and enforces domain diversity so no single source dominates the top positions.

### Step 5: Packaged JSON Response

The `/api/search` endpoint returns the final ranked results plus metadata: expanded queries, domain clusters, cost estimate, duration. The same shape you would get from a fancy search API vendor.

---

## The Cost Math

Here is what this actually costs per search:

|                         | This project | Fancy search API vendors |
| ----------------------- | ------------ | ------------------------ |
| Cost per search         | ~$0.008      | ~$0.035-0.05             |
| Cost per 1,000 searches | ~$8          | ~$35-50                  |
| You own the code        | Yes          | No                       |
| Vendor lock-in          | None         | Yes                      |

The SERP retrieval costs $1.50 per 1,000 requests through Bright Data. With 5 sub-queries per search, that is $0.0075 per search for retrieval. The LLM query expansion is a single GPT-4o-mini call, roughly $0.00015. The reranking is free because it runs in your own code.

Total: about $0.008 per search.

In most cases, SERP is all you need, and it can cost roughly 90% less than a fancy search API because you are not paying for a wrapper and credit multipliers.

---

## The Baseline Layer

One thing fancy search APIs do not give you is historical comparison. You cannot easily ask "what changed since last week?"

I added a baseline layer using the Bright Data Datasets API. The idea is simple: trigger a SERP collection for your queries, store the snapshot, then compare future live results against it.

The UI shows three categories after comparison:

- **New sources**: URLs appearing in live results but not in the baseline
- **Gone sources**: URLs that were in the baseline but have dropped out
- **Persistent sources**: URLs appearing in both

You can refresh the baseline daily or weekly. For SEO monitoring, competitive research, or any use case where you care about result drift, this is genuinely useful. And it is built on the same Bright Data infrastructure, so there is no new vendor to add.

---

## Running It Yourself

Five minutes to get started:

```bash
git clone https://github.com/yaronbeen/unfancy-search.git
cd unfancy-search
pnpm install
cp .env.example .env
```

Fill in your Bright Data API token and SERP zone name. OpenAI key is optional. Then:

```bash
pnpm dev
```

Open `http://localhost:3000`. Search for anything.

The project has 110 unit tests covering the full pipeline. Run them with `pnpm test`.

---

## What This Does Not Replace

I am not going to pretend this is a drop-in replacement for everything.

If you need sub-200ms latency with a pre-built index, SERP scraping has inherent overhead. If you need full-page content extraction at scale, you will want a scraper or unlocker on top. If you need a managed service and do not want to maintain code, paying the markup is a reasonable choice.

But for most search features in most apps? Query expansion plus SERP plus reranking gets you 90% of the way. And you keep the other 90% of your money.

The fancy search API vendors are selling convenience and abstraction. That is a legitimate product. But you should know what you are buying, and you should know that the underlying pipeline is not magic.

It is four functions and a POST request.

---

## Get Started

- **Bright Data SERP API**: [brightdata.com](https://brightdata.com) (get an API key, create a SERP zone)
- **GitHub repo**: [github.com/yaronbeen/unfancy-search](https://github.com/yaronbeen/unfancy-search)
- **Live demo**: [unfancy-search.netlify.app](https://unfancy-search.netlify.app)

Clone it. Break it. Build on it. Ship it.

If this saved you from paying for a fancy search API, that is the whole point.
