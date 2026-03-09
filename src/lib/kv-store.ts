import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Unified KV store helper.
 * Maps logical store names to Cloudflare KV namespace bindings.
 *
 * Job entries auto-expire after 1 hour (3600s).
 * Baselines persist indefinitely.
 */

type StoreName = "search-jobs" | "baseline-jobs" | "baselines";

const JOB_TTL_SECONDS = 3600; // 1 hour

function getKVNamespace(name: StoreName): KVNamespace {
  const { env } = getCloudflareContext();
  switch (name) {
    case "search-jobs":
      return env.SEARCH_JOBS_KV;
    case "baseline-jobs":
      return env.BASELINE_JOBS_KV;
    case "baselines":
      return env.BASELINES_KV;
  }
}

export async function kvGet<T = unknown>(
  store: StoreName,
  key: string,
): Promise<T | null> {
  const kv = getKVNamespace(store);
  return kv.get<T>(key, "json");
}

export async function kvSet(
  store: StoreName,
  key: string,
  value: unknown,
): Promise<void> {
  const kv = getKVNamespace(store);
  const ttl = store === "baselines" ? undefined : JOB_TTL_SECONDS;
  await kv.put(
    key,
    JSON.stringify(value),
    ttl ? { expirationTtl: ttl } : undefined,
  );
}
