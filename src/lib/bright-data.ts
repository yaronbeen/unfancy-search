import { SerpResult } from "./types";

const API_BASE = "https://api.brightdata.com/request";

interface SerpRequestParams {
  query: string;
  search_engine: "google" | "bing";
  country?: string;
  num_results?: number;
}

interface BrightDataOrganic {
  link?: string; // Bright Data format:json wrapper uses 'link'
  url?: string; // brd_json=1 + format:raw uses 'url'
  title: string;
  description?: string;
  snippet?: string;
  rank?: number;
  position?: number;
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
    // Bing still supports count parameter
    return `https://www.bing.com/search?q=${q}&count=${numResults}&cc=${country}&setlang=en`;
  }

  // Google: num param is dead since Sep 2025.
  // brd_json=1 tells Bright Data to parse the HTML into structured JSON.
  // pws=0 = non-personalized results, hl=en = English interface.
  return `https://www.google.com/search?q=${q}&gl=${country}&hl=en&pws=0&brd_json=1`;
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
      // Google: use 'raw' so brd_json=1 parsed JSON is returned directly.
      // Bing: use 'json' for Bright Data's own wrapper format.
      format: params.search_engine === "google" ? "raw" : "json",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SERP API error ${res.status}: ${text}`);
  }

  let data: BrightDataSerpResponse;
  try {
    data = (await res.json()) as BrightDataSerpResponse;
  } catch {
    console.error("SERP response was not valid JSON");
    return [];
  }

  const results: SerpResult[] = [];

  if (data.organic) {
    for (const item of data.organic) {
      // Handle both field names: brd_json=1 uses 'url', format:json uses 'link'
      const url = item.url || item.link || "";
      if (!url) continue;
      results.push({
        title: item.title || "",
        url,
        description: item.description || item.snippet || "",
        position: item.position ?? item.rank ?? results.length + 1,
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
