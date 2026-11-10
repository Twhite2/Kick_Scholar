/**
 * Fetchers for ROR, Wikidata and Wikimedia Commons (docs/ui-remodel.md §11.2).
 *
 * Wikimedia's User-Agent policy requires a descriptive agent with contact
 * details, at most two requests a second, and backing off on 429 and 5xx.
 * The contact comes from MEDIA_BOT_CONTACT and is never guessed.
 */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
    });
    if (res.ok) return res;
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
}

export async function fetchWikidata(qid: string): Promise<WikidataFacts> {
  const res = await request(`https://www.wikidata.org/wiki/Special:EntityData/${encodeURIComponent(qid)}.json`, { wikimedia: true });
  const json = (await res.json()) as { entities?: Record<string, { claims?: Record<string, Array<{ mainsnak?: { datavalue?: { value?: unknown } } }>> }> };
  const entity = Object.values(json.entities ?? {})[0];
  const first = (prop: string) => {
    const v = entity?.claims?.[prop]?.[0]?.mainsnak?.datavalue?.value;
    return typeof v === "string" ? v : null;
  };
  return { logoFile: first("P154"), imageFile: first("P18"), website: first("P856") };
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
  const res = await fetch(`https://img.logo.dev/${encodeURIComponent(domain)}?token=${encodeURIComponent(token)}&size=256&format=png&fallback=404`);
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}
