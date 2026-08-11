const TRACKING_PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid", "cHash"];

/** Canonicalizes a URL for dedup/comparison: https, no tracking params, no trailing slash, sorted query. */
export function canonicalizeUrl(rawUrl: string): string {
  const url = new URL(rawUrl);
  url.protocol = "https:";
  for (const param of TRACKING_PARAMS) url.searchParams.delete(param);
  url.searchParams.sort();
  let result = url.toString();
  if (result.endsWith("/") && url.pathname !== "/") result = result.slice(0, -1);
  return result;
}

export function sameCanonicalUrl(a: string, b: string): boolean {
  try {
    return canonicalizeUrl(a) === canonicalizeUrl(b);
  } catch {
    return a === b;
  }
}
