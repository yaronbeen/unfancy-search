import { SerpResult } from "./types";

const API_BASE = "https://api.brightdata.com/request";

interface SerpRequestParams {
  query: string;
  search_engine: "google" | "bing";
  country?: string;
  num_results?: number;
}

interface BrightDataOrganic {
  link: string;
  title: string;
  description?: string;
  rank: number;
  global_rank?: number;
  source?: string;
}

interface BrightDataSerpResponse {
  organic?: BrightDataOrganic[];
  general?: {
    search_engine: string;
    query: string;
    results_cnt?: number;
  };
}

function buildSearchUrl(
  query: string,
  engine: "google" | "bing",
  country: string,
  numResults: number,
): string {
  const q = encodeURIComponent(query);

  if (engine === "bing") {
    return `https://www.bing.com/search?q=${q}&count=${numResults}&cc=${country}`;
  }

  // Google
  return `https://www.google.com/search?q=${q}&gl=${country}&num=${numResults}`;
}

export async function fetchSerp(
  params: SerpRequestParams,
): Promise<SerpResult[]> {
  const apiToken = process.env.BRIGHT_DATA_API_TOKEN;
  if (!apiToken) {
    throw new Error("BRIGHT_DATA_API_TOKEN is not set");
  }

  const zone = process.env.BRIGHT_DATA_SERP_ZONE || "serp_api1";
  const country = params.country || "us";
  const numResults = params.num_results || 10;

  const searchUrl = buildSearchUrl(
    params.query,
    params.search_engine,
    country,
    numResults,
  );

  const res = await fetch(API_BASE, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      zone,
      url: searchUrl,
      format: "json",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SERP API error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as BrightDataSerpResponse;

  const results: SerpResult[] = [];

  if (data.organic) {
    for (const item of data.organic) {
      results.push({
        title: item.title || "",
        url: item.link || "",
        description: item.description || "",
        position: item.rank || results.length + 1,
        source_engine: params.search_engine,
        source_query: params.query,
      });
    }
  }

  return results;
}

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
