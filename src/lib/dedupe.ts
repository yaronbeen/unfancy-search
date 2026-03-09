/**
 * URL canonicalization and deduplication.
 *
 * Strips tracking params, normalizes www/non-www,
 * removes trailing slashes, lowercases.
 */

const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "ref",
  "fbclid",
  "gclid",
  "msclkid",
  "mc_cid",
  "mc_eid",
  "s_kwcid",
  "_ga",
  "ck_subscriber_id",
]);

export function canonicalizeUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);

    // Lowercase hostname
    url.hostname = url.hostname.toLowerCase();

    // Strip www.
    if (url.hostname.startsWith("www.")) {
      url.hostname = url.hostname.slice(4);
    }

    // Remove tracking params
    for (const param of TRACKING_PARAMS) {
      url.searchParams.delete(param);
    }

    // Sort remaining params for consistency
    url.searchParams.sort();

    // Remove trailing slash
    let path = url.pathname;
    if (path.length > 1 && path.endsWith("/")) {
      path = path.slice(0, -1);
    }

    // Remove fragment
    return `${url.protocol}//${url.hostname}${path}${url.search}`;
  } catch {
    return rawUrl.toLowerCase().replace(/\/$/, "");
  }
}

export function extractDomain(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    let hostname = url.hostname.toLowerCase();
    if (hostname.startsWith("www.")) {
      hostname = hostname.slice(4);
    }
    return hostname;
  } catch {
    return rawUrl;
  }
}
