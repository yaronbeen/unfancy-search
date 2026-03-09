import { SerpResult } from "./types";

const SERP_API_BASE = "https://api.brightdata.com/serp/req";

interface SerpRequestParams {
  query: string;
  search_engine: "google" | "bing";
  country?: string;
  num_results?: number;
}

interface BrightDataSerpResponse {
  organic?: Array<{
    title: string;
    link: string;
    description: string;
    rank: number;
  }>;
  general?: {
    search_engine: string;
  };
}

export async function fetchSerp(
  params: SerpRequestParams,
): Promise<SerpResult[]> {
  const apiToken = process.env.BRIGHT_DATA_API_TOKEN;
  if (!apiToken) {
    throw new Error("BRIGHT_DATA_API_TOKEN is not set");
  }

  const body = JSON.stringify([
    {
      query: params.query,
      search_engine: params.search_engine,
      country: params.country || "us",
      num: params.num_results || 10,
    },
  ]);

  const res = await fetch(SERP_API_BASE, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SERP API error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as BrightDataSerpResponse[];

  const results: SerpResult[] = [];

  for (const response of data) {
    if (!response.organic) continue;
    for (const item of response.organic) {
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
