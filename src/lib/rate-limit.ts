import { getCloudflareContext } from "@opennextjs/cloudflare";

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter?: number;
}

/**
 * Simple KV-based rate limiter.
 * Uses SEARCH_JOBS_KV with "rl:" prefix to avoid key collisions.
 * Not perfectly atomic (KV is eventually consistent) but sufficient for abuse prevention.
 */
export async function checkRateLimit(
  ip: string,
  endpoint: "search" | "baseline",
  maxRequests: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const { env } = getCloudflareContext();
  const kv = env.SEARCH_JOBS_KV;

  const windowStart = Math.floor(Date.now() / (windowSeconds * 1000));
  const key = `rl:${endpoint}:${ip}:${windowStart}`;

  const current = await kv.get(key, "text");
  const count = current ? parseInt(current, 10) : 0;

  if (count >= maxRequests) {
    const windowEndSec = (windowStart + 1) * windowSeconds;
    const nowSec = Math.floor(Date.now() / 1000);
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.max(1, windowEndSec - nowSec),
    };
  }

  // Increment — not atomic but good enough for KV-based rate limiting
  await kv.put(key, String(count + 1), {
    expirationTtl: windowSeconds * 2,
  });

  return { allowed: true, remaining: maxRequests - count - 1 };
}

/**
 * Extract client IP from request headers.
 * Cloudflare Workers set CF-Connecting-IP automatically.
 */
export function getClientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}
