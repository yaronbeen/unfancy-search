declare global {
  interface CloudflareEnv {
    SEARCH_JOBS_KV: KVNamespace;
    BASELINE_JOBS_KV: KVNamespace;
    BASELINES_KV: KVNamespace;
    BRIGHT_DATA_API_TOKEN: string;
    BRIGHT_DATA_SERP_ZONE: string;
    BRIGHT_DATA_DATASET_ID: string;
    ANTHROPIC_API_KEY: string;
    ASSETS: Fetcher;
  }
}

export {};
