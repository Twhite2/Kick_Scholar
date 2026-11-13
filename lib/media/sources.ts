/**
 * Fetchers for ROR, Wikidata and Wikimedia Commons (docs/ui-remodel.md §11.2).
 *
 * Wikimedia's User-Agent policy requires a descriptive agent with contact
 * details, at most two requests a second, and backing off on 429 and 5xx.
 * The contact comes from MEDIA_BOT_CONTACT and is never guessed.
 */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Drains a response body that will not be used. Left unread, it is aborted
 * later by the request's timeout with no handler attached; cancelling it
 * mid-stream instead tears the socket down under Node's fetch. Reading it to
 * the end (an error page or a mistyped icon, small) avoids both.
 */
async function discard(res: Response): Promise<void> {
  await res.arrayBuffer().catch(() => {});
}

/** Every request gives up after this long, so a dropped connection cannot stall a batch. */
const REQUEST_TIMEOUT_MS = 30_000;

export function userAgent(): string {
  const contact = process.env.MEDIA_BOT_CONTACT?.trim();
  if (!contact) {
    throw new Error("Set MEDIA_BOT_CONTACT (an email or URL people can reach you at) before calling Wikimedia APIs.");
  }
  const site = process.env.MEDIA_BOT_URL?.trim() || "https://kickscholar.example";
  return `KickScholarMediaBot/1.0 (${site}; ${contact})`;
}

let lastWikimediaCall = 0;
const WIKIMEDIA_GAP_MS = 550; // stays under 2 requests per second

async function request(url: string, opts: { wikimedia: boolean; binary?: boolean; tries?: number }): Promise<Response> {
  const tries = opts.tries ?? 4;
  for (let attempt = 1; ; attempt++) {
    if (opts.wikimedia) {
      const wait = lastWikimediaCall + WIKIMEDIA_GAP_MS - Date.now();
      if (wait > 0) await sleep(wait);
      lastWikimediaCall = Date.now();
    }
    const res = await fetch(url, {
      headers: { "User-Agent": opts.wikimedia ? userAgent() : "KickScholarMediaBot/1.0", Accept: opts.binary ? "*/*" : "application/json" },
      redirect: "follow",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (res.ok) return res;
    await discard(res);
    if ((res.status === 429 || res.status >= 500) && attempt < tries) {
      const retryAfter = Number(res.headers.get("retry-after"));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt);
      continue;
    }
    throw new Error(`${res.status} ${res.statusText} for ${url}`);
  }
}

// ---------------------------------------------------------------------------
// ROR (CC0). API v2; v1 is retired.
// ---------------------------------------------------------------------------

export interface RorFacts {
  acronym: string | null;
  domain: string | null;
  website: string | null;
  wikidataId: string | null;
}

export async function fetchRor(rorId: string): Promise<RorFacts> {
  const res = await request(`https://api.ror.org/v2/organizations/${encodeURIComponent(rorId)}`, { wikimedia: false });
  const json = (await res.json()) as {
    names?: Array<{ value: string; types?: string[] }>;
    domains?: string[];
    links?: Array<{ type: string; value: string }>;
    external_ids?: Array<{ type: string; all?: string[]; preferred?: string | null }>;
  };
  const wikidata = json.external_ids?.find((e) => e.type === "wikidata");
  return {
    acronym: json.names?.find((n) => n.types?.includes("acronym"))?.value ?? null,
    domain: json.domains?.[0] ?? null,
    website: json.links?.find((l) => l.type === "website")?.value ?? null,
    wikidataId: wikidata?.preferred ?? wikidata?.all?.[0] ?? null,
  };
}

// ---------------------------------------------------------------------------
// Wikidata: P154 logo image, P18 image, P856 official website
// ---------------------------------------------------------------------------

export interface WikidataFacts {
  logoFile: string | null;
  imageFile: string | null;
  website: string | null;
  /** Wikipedia article titles, for the page-image fallback. */
  sitelinks: { en: string | null; de: string | null; local: string | null };
  /** Entity ids of P31 (instance of) and P17 (country), for verifying a name search. */
  instanceOf: string[];
  countries: string[];
}

type Claims = Record<string, Array<{ mainsnak?: { datavalue?: { value?: unknown } } }>>;

export async function fetchWikidata(qid: string, localLang?: string): Promise<WikidataFacts> {
  const res = await request(`https://www.wikidata.org/wiki/Special:EntityData/${encodeURIComponent(qid)}.json`, { wikimedia: true });
  const json = (await res.json()) as {
    entities?: Record<string, { claims?: Claims; sitelinks?: Record<string, { title?: string }> }>;
  };
  const entity = Object.values(json.entities ?? {})[0];
  const first = (prop: string) => {
    const v = entity?.claims?.[prop]?.[0]?.mainsnak?.datavalue?.value;
    return typeof v === "string" ? v : null;
  };
  const ids = (prop: string) =>
    (entity?.claims?.[prop] ?? []).flatMap((c) => {
      const v = c.mainsnak?.datavalue?.value as { id?: string } | undefined;
      return v?.id ? [v.id] : [];
    });
  const link = (wiki: string) => entity?.sitelinks?.[wiki]?.title ?? null;
  return {
    logoFile: first("P154"),
    imageFile: first("P18"),
    website: first("P856"),
    sitelinks: { en: link("enwiki"), de: link("dewiki"), local: localLang ? link(`${localLang}wiki`) : null },
    instanceOf: ids("P31"),
    countries: ids("P17"),
  };
}

/** Wikidata items for the countries we enrich, to verify a name search. */
export const COUNTRY_QID: Record<string, string> = {
  DE: "Q183", GB: "Q145", FR: "Q142", NL: "Q55", SE: "Q34", FI: "Q33", DK: "Q35", NO: "Q20", BE: "Q31", IE: "Q27", AU: "Q408",
};

/** "instance of" values that mean a higher-education institution. */
// A name search must also match the exact label and the country, so this
// list can be generous about the kind of institution.
const HIGHER_EDUCATION = new Set([
  "Q3918", // university
  "Q875538", // public university
  "Q902104", // private university
  "Q15936437", // research university
  "Q1371037", // institute of technology
  "Q38723", // higher education institution
  "Q3354859", // collegiate university
  "Q1500642", // Fachhochschule
  "Q3551775", // university of applied sciences
  "Q2385804", // educational institution
  "Q1664720", // institute
]);

/**
 * Finds an institution's Wikidata item by name when ROR has none. Accepted
 * only when the item's label matches the name exactly (case-insensitive), it
 * is in the expected country, and it is a higher-education institution —
 * anything less certain is skipped rather than risking another body's logo.
 */
export async function findWikidataByName(name: string, countryCode: string): Promise<string | null> {
  const country = COUNTRY_QID[countryCode];
  if (!country) return null;
  const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=en&type=item&limit=5&search=${encodeURIComponent(name)}`;
  const res = await request(url, { wikimedia: true });
  const json = (await res.json()) as { search?: Array<{ id: string; label?: string; match?: { text?: string } }> };
  const wanted = name.trim().toLowerCase();
  for (const hit of json.search ?? []) {
    const label = (hit.label ?? hit.match?.text ?? "").trim().toLowerCase();
    if (label !== wanted && (hit.match?.text ?? "").trim().toLowerCase() !== wanted) continue;
    const facts = await fetchWikidata(hit.id);
    if (!facts.countries.includes(country)) continue;
    if (!facts.instanceOf.some((q) => HIGHER_EDUCATION.has(q))) continue;
    return hit.id;
  }
  return null;
}

/** The lead image of a Wikipedia article, as a Commons file name. */
export async function fetchPageImage(lang: string, title: string): Promise<string | null> {
  const url = `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&piprop=name&titles=${encodeURIComponent(title)}`;
  const res = await request(url, { wikimedia: true });
  const json = (await res.json()) as { query?: { pages?: Record<string, { pageimage?: string }> } };
  const page = Object.values(json.query?.pages ?? {})[0];
  return page?.pageimage ?? null;
}

/**
 * The logo an institution's own website declares for itself: its
 * apple-touch-icon or a large icon link. Only raster icons of 120px or more
 * are used; tiny favicons would look blurred on a 52px tile.
 */
export async function fetchSiteIcon(website: string): Promise<Buffer | null> {
  let html: string;
  let base: URL;
  try {
    const res = await fetch(website, {
      headers: { "User-Agent": "KickScholarMediaBot/1.0 (+https://github.com/Twhite2/Kick_Scholar)", Accept: "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      await discard(res);
      return null;
    }
    base = new URL(res.url || website);
    html = (await res.text()).slice(0, 400_000);
  } catch {
    return null;
  }
  const links = [...html.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]);
  const candidates: Array<{ href: string; size: number }> = [];
  for (const tag of links) {
    const rel = tag.match(/\brel=["']([^"']+)["']/i)?.[1]?.toLowerCase() ?? "";
    if (!/apple-touch-icon|(^|\s)icon(\s|$)/.test(rel)) continue;
    const href = tag.match(/\bhref=["']([^"']+)["']/i)?.[1];
    if (!href || /\.svg(\?|$)/i.test(href) || href.startsWith("data:")) continue;
    const sizes = tag.match(/\bsizes=["'](\d+)x(\d+)["']/i);
    const size = sizes ? Number(sizes[1]) : /apple-touch-icon/.test(rel) ? 180 : 0;
    candidates.push({ href, size });
  }
  candidates.sort((a, b) => b.size - a.size);
  const best = candidates.find((c) => c.size >= 120);
  if (!best) return null;
  try {
    const res = await fetch(new URL(best.href, base), {
      headers: { "User-Agent": "KickScholarMediaBot/1.0 (+https://github.com/Twhite2/Kick_Scholar)" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok || !/image\/(png|jpeg|webp|x-icon|vnd.microsoft.icon)/i.test(res.headers.get("content-type") ?? "image/png")) {
      await discard(res);
      return null;
    }
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Wikimedia Commons image info
// ---------------------------------------------------------------------------

export interface CommonsImage {
  title: string;
  /** A raster rendering at the requested width (Commons renders SVG to PNG). */
  thumbUrl: string;
  thumbWidth: number;
  thumbHeight: number;
  width: number;
  height: number;
  mime: string;
  pageUrl: string;
  artist: string | null;
  license: string | null;
  licenseUrl: string | null;
  description: string | null;
}

function stripHtml(s: string | undefined): string | null {
  if (!s) return null;
  const text = s.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
  return text || null;
}

export async function fetchCommonsImage(fileName: string, width: number): Promise<CommonsImage | null> {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&titles=${encodeURIComponent(`File:${fileName}`)}&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=${width}`;
  const res = await request(url, { wikimedia: true });
  const json = (await res.json()) as {
    query?: {
      pages?: Record<
        string,
        {
          title?: string;
          imageinfo?: Array<{
            thumburl?: string;
            thumbwidth?: number;
            thumbheight?: number;
            width?: number;
            height?: number;
            mime?: string;
            descriptionurl?: string;
            extmetadata?: Record<string, { value?: string }>;
          }>;
        }
      >;
    };
  };
  const page = Object.values(json.query?.pages ?? {})[0];
  const info = page?.imageinfo?.[0];
  if (!info?.thumburl) return null;
  const meta = info.extmetadata ?? {};
  return {
    title: page?.title ?? fileName,
    thumbUrl: info.thumburl,
    thumbWidth: info.thumbwidth ?? 0,
    thumbHeight: info.thumbheight ?? 0,
    width: info.width ?? 0,
    height: info.height ?? 0,
    mime: info.mime ?? "",
    pageUrl: info.descriptionurl ?? `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(fileName)}`,
    artist: stripHtml(meta.Artist?.value),
    license: stripHtml(meta.LicenseShortName?.value),
    licenseUrl: stripHtml(meta.LicenseUrl?.value),
    description: stripHtml(meta.ImageDescription?.value),
  };
}

export async function download(url: string, wikimedia: boolean): Promise<Buffer> {
  const res = await request(url, { wikimedia, binary: true });
  return Buffer.from(await res.arrayBuffer());
}

/** Logo fallback by domain (Logo.dev). Only used when LOGO_DEV_TOKEN is set. */
export async function fetchLogoDev(domain: string): Promise<Buffer | null> {
  const token = process.env.LOGO_DEV_TOKEN?.trim();
  if (!token) return null;
  const res = await fetch(`https://img.logo.dev/${encodeURIComponent(domain)}?token=${encodeURIComponent(token)}&size=256&format=png&fallback=404`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) {
    await discard(res);
    return null;
  }
  return Buffer.from(await res.arrayBuffer());
}
