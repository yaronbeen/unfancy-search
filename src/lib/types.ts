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

export interface SearchRequest {
  query: string;
  engines: ("google" | "bing")[];
  geo: string;
  num_results: number;
  research_mode: boolean;
  domain_include: string[];
  domain_exclude: string[];
}

export interface SearchResponse {
  query: string;
  expanded_queries: string[];
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
  total_serp_results: number;
  unique_after_dedup: number;
  queries_executed: number;
  engines_used: string[];
  geo: string;
  estimated_cost_usd: number;
  duration_ms: number;
}
