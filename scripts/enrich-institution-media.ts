import "dotenv/config";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { isCliEntrypoint } from "../lib/cliEntrypoint";
import { getMediaStore } from "../lib/media/store";
import { coverRejection, logoAspect, MAX_LOGO_ASPECT, processCover, processLogo } from "../lib/media/process";
import {
  download,
  fetchCommonsImage,
  fetchLogoDev,
  fetchPageImage,
  fetchRor,
  fetchSiteIcon,
  fetchWikidata,
  findWikidataByName,
  userAgent,
} from "../lib/media/sources";

/**
 * Finds a logo and a campus photo for each institution and caches them on our
 * own storage, keeping the photo's credit and licence (docs/ui-remodel.md §11).
 *
 * Logo sources, in order: Wikidata's logo image (P154), the icon the
 * institution's own website declares, Logo.dev (only with LOGO_DEV_TOKEN).
 * Photo sources: Wikidata's image (P18), then the lead image of the
 * institution's Wikipedia article. Institutions without a ROR Wikidata id are
 * looked up by exact name, country and type.
 *
 *   npm run media:enrich -- --country FI,SE --limit 50 [--only-missing] [--dry-run] [--force]
 *
 *   --country   ISO codes, comma separated. With several, --limit applies to each.
 *   --limit     Institutions per country (default 50).
 *   --only-missing  Skip institutions that already have both a logo and a cover.
 *   --dry-run   Fetch and check everything, write nothing.
 *   --force     Re-check rows checked in the last 30 days.
 *   --with-programmes  Only institutions that have programmes (the ones students see), most programmes first.
 *   --refresh   Re-fetch a logo or cover even when one is already stored.
 *   --recheck-wide-logos  Only check stored logos: a wide wordmark is replaced
 *               by the site's square icon, or cleared so the monogram shows.
 *
 * Resumable: rows checked within 30 days are skipped unless --force, and rows
 * an admin has locked (mediaLocked) are never touched. Writes a CSV report to
 * tmp/media-report-{date}.csv.
 *
 * Requires MEDIA_BOT_CONTACT (Wikimedia's User-Agent policy). Uses
 * LOGO_DEV_TOKEN as a logo fallback only when set; read Logo.dev's terms
 * before enabling it.
 */

interface Args {
  countries: string[];
  limit: number;
  onlyMissing: boolean;
  dryRun: boolean;
  force: boolean;
  withProgrammes: boolean;
  refresh: boolean;
  recheckWideLogos: boolean;
}

function parseArgs(argv: string[]): Args {
  const get = (name: string) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const limit = Number(get("limit") ?? 50);
  return {
    countries: (get("country") ?? "").split(",").map((c) => c.trim().toUpperCase()).filter(Boolean),
    limit: Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 50,
    onlyMissing: argv.includes("--only-missing"),
    dryRun: argv.includes("--dry-run"),
    force: argv.includes("--force"),
    withProgrammes: argv.includes("--with-programmes"),
    refresh: argv.includes("--refresh"),
    recheckWideLogos: argv.includes("--recheck-wide-logos"),
  };
}

interface ReportRow {
  id: string;
  name: string;
  country: string;
  logo: string;
  logoSource: string;
  cover: string;
  reason: string;
}

const csv = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/**
 * The first logo, in source order, that is not a wide wordmark. A source
 * that returns only a wordmark is passed over for the next one; with none
 * left, the institution keeps its monogram.
 */
async function firstSquareLogo(sources: Array<[string, () => Promise<Buffer | null>]>): Promise<{ logo: Buffer | null; source: string; wide: boolean }> {
  let wide = false;
  for (const [source, get] of sources) {
    const candidate = await get().catch(() => null);
    if (!candidate) continue;
    const aspect = await logoAspect(candidate).catch(() => Infinity);
    if (aspect > MAX_LOGO_ASPECT) {
      wide = true;
      continue;
    }
    return { logo: candidate, source, wide };
  }
  return { logo: null, source: "", wide };
}

/**
 * Stored logos that turn out to be wide wordmarks: replaced by the site's
 * own square icon when it has one, otherwise cleared so the monogram shows.
 * Reads the stored files, so it needs no Wikidata calls.
 */
export async function recheckWideLogos(prisma: PrismaClient, args: Args, onRow?: (row: ReportRow) => Promise<void>): Promise<ReportRow[]> {
  const store = getMediaStore();
  const report: ReportRow[] = [];
  const rows = await prisma.university.findMany({
    where: { mediaLocked: false, logoUrl: { startsWith: "/media/" }, ...(args.countries.length ? { country: { in: args.countries } } : {}) },
    select: { id: true, name: true, country: true, website: true, logoUrl: true, logoSource: true },
  });
  for (const u of rows) {
    let aspect: number;
    try {
      aspect = await logoAspect(await readFile(path.join(process.cwd(), "public", u.logoUrl!)));
    } catch {
      continue;
    }
    if (aspect <= MAX_LOGO_ASPECT) continue;
    const row: ReportRow = { id: u.id, name: u.name, country: u.country, logo: "cleared", logoSource: "", cover: "kept", reason: `wide wordmark (${aspect.toFixed(1)}:1)` };
    const { logo, source } =
      u.logoSource === "site-icon" || !u.website ? { logo: null, source: "" } : await firstSquareLogo([["site-icon", () => fetchSiteIcon(u.website!)]]);
    if (logo) {
      row.logo = "ok";
      row.logoSource = source;
    }
    if (!args.dryRun) {
      if (logo) {
        const { w256, w128 } = await processLogo(logo);
        const logoUrl = await store.put(`logos/${u.id}-256.webp`, w256, "image/webp");
        await store.put(`logos/${u.id}-128.webp`, w128, "image/webp");
        await prisma.university.update({ where: { id: u.id }, data: { logoUrl, logoSource: source } });
      } else {
        await prisma.university.update({ where: { id: u.id }, data: { logoUrl: null, logoSource: null } });
      }
    }
    report.push(row);
    await onRow?.(row);
    console.log(`${row.country} ${row.logo.padEnd(7)} ${u.name} (${row.reason})`);
  }
  return report;
}

export async function enrich(prisma: PrismaClient, args: Args, onRow?: (row: ReportRow) => Promise<void>): Promise<ReportRow[]> {
  userAgent(); // fail fast without a contact
  const store = getMediaStore();
  const stale = new Date(Date.now() - 30 * 86_400_000);
  const countries = args.countries.length > 0 ? args.countries : [null];
  const report: ReportRow[] = [];

  for (const country of countries) {
    const rows = await prisma.university.findMany({
      where: {
        mediaLocked: false,
        ...(country ? { country } : {}),
        ...(args.onlyMissing ? { OR: [{ logoUrl: null }, { coverUrl: null }] } : {}),
        ...(args.force ? {} : { AND: [{ OR: [{ logoCheckedAt: null }, { logoCheckedAt: { lt: stale } }] }] }),
        ...(args.withProgrammes ? { programs: { some: {} } } : {}),
      },
      // The institutions students see most come first.
      orderBy: args.withProgrammes
        ? [{ programs: { _count: "desc" } }]
        : [{ fundingOpportunities: { _count: "desc" } }, { programs: { _count: "desc" } }],
      take: args.limit,
      select: { id: true, name: true, country: true, website: true, rorId: true, externalIds: true, wikidataId: true, acronym: true, domain: true, logoUrl: true, coverUrl: true },
    });

    for (const u of rows) {
      const row: ReportRow = {
        id: u.id,
        name: u.name,
        country: u.country,
        logo: u.logoUrl ? "kept" : "none",
        logoSource: "",
        cover: u.coverUrl ? "kept" : "none",
        reason: "",
      };
      const reasons: string[] = [];
      const data: Record<string, unknown> = { logoCheckedAt: new Date(), coverCheckedAt: new Date() };
      // Only fetch what's missing, unless asked to refresh everything.
      const wantLogo = !u.logoUrl || args.refresh;
      const wantCover = !u.coverUrl || args.refresh;
      try {
        const ror = u.rorId ? await fetchRor(u.rorId) : null;
        const stored = (u.externalIds as { wikidata?: string } | null)?.wikidata ?? null;
        let qid = ror?.wikidataId ?? stored ?? u.wikidataId;
        if (!qid) {
          // No identifier from ROR: a strict name search (exact label, same
          // country, a higher-education institution) or nothing.
          qid = await findWikidataByName(u.name, u.country);
          if (qid) row.logoSource = "name-search";
        }
        if (ror?.acronym && !u.acronym) data.acronym = ror.acronym;
        if (ror?.domain && !u.domain) data.domain = ror.domain;
        if (qid) data.wikidataId = qid;
        const localLang = u.country === "DE" ? "de" : u.country === "FR" ? "fr" : u.country === "NL" ? "nl" : u.country === "SE" ? "sv" : u.country === "FI" ? "fi" : u.country === "DK" ? "da" : u.country === "NO" ? "no" : undefined;
        const wd = qid ? await fetchWikidata(qid, localLang) : null;

        // Logo: Wikidata P154 rasterised by Commons (never third-party SVG),
        // then the icon the institution's own site declares, then Logo.dev.
        if (wantLogo) {
          const site = wd?.website ?? ror?.website ?? u.website;
          const domain = ror?.domain ?? u.domain;
          const { logo, source, wide } = await firstSquareLogo([
            [
              "wikidata",
              async () => {
                if (!wd?.logoFile) return null;
                const img = await fetchCommonsImage(wd.logoFile, 512);
                return img ? download(img.thumbUrl, true) : null;
              },
            ],
            ["site-icon", async () => (site ? fetchSiteIcon(site) : null)],
            ["logo.dev", async () => (domain ? fetchLogoDev(domain) : null)],
          ]);
          if (logo) {
            const { w256, w128 } = await processLogo(logo);
            if (!args.dryRun) {
              data.logoUrl = await store.put(`logos/${u.id}-256.webp`, w256, "image/webp");
              await store.put(`logos/${u.id}-128.webp`, w128, "image/webp");
              data.logoSource = source;
            }
            row.logo = "ok";
            row.logoSource = source;
          } else {
            reasons.push(wide ? "only a wide wordmark (the monogram reads better)" : wd ? "no logo found" : "no Wikidata item and no site icon");
          }
        }

        // Cover: Wikidata P18, else the lead image of its Wikipedia article.
        // Every candidate passes the same checks before download.
        if (wantCover) {
          const files = [
            wd?.imageFile ?? null,
            ...(await Promise.all(
              [
                wd?.sitelinks.local ? ([localLang!, wd.sitelinks.local] as const) : null,
                wd?.sitelinks.en ? (["en", wd.sitelinks.en] as const) : null,
                wd?.sitelinks.de && localLang !== "de" ? (["de", wd.sitelinks.de] as const) : null,
              ].map(async (p) => (p ? fetchPageImage(p[0], p[1]).catch(() => null) : null)),
            )),
          ].filter((f, i, all): f is string => Boolean(f) && all.indexOf(f) === i);
          let accepted = false;
          const rejections: string[] = [];
          for (const file of files) {
            const img = await fetchCommonsImage(file, 1600);
            const rejected = img
              ? coverRejection({ mime: img.mime, width: img.width, height: img.height, title: img.title, description: img.description })
              : "no image info";
            if (!img || rejected) {
              rejections.push(rejected ?? "no image info");
              continue;
            }
            const { variants, color } = await processCover(await download(img.thumbUrl, true));
            const largest = variants[variants.length - 1];
            if (!args.dryRun) {
              let largestUrl = "";
              for (const v of variants) {
                const url = await store.put(`covers/${u.id}-${v.width}.webp`, v.body, "image/webp");
                if (v === largest) largestUrl = url;
              }
              Object.assign(data, {
                coverUrl: largestUrl,
                coverWidth: largest.width,
                coverHeight: largest.height,
                coverColor: color,
                coverCredit: img.artist,
                coverLicense: img.license,
                coverLicenseUrl: img.licenseUrl,
                coverSourceUrl: img.pageUrl,
              });
            }
            row.cover = "ok";
            accepted = true;
            break;
          }
          if (!accepted) {
            row.cover = files.length ? "rejected" : "none";
            reasons.push(files.length ? `cover ${rejections.join(", ")}` : "no photo found");
          }
        }

        if (!args.dryRun) await prisma.university.update({ where: { id: u.id }, data });
      } catch (err) {
        reasons.push(`error: ${(err as Error).message}`);
      }
      row.reason = reasons.join("; ");
      report.push(row);
      await onRow?.(row);
      console.log(`${row.country} ${row.logo.padEnd(4)} ${row.cover.padEnd(8)} ${u.name}${row.reason ? ` (${row.reason})` : ""}`);
    }
  }
  return report;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  // A batch runs for an hour or more over thousands of third-party requests.
  // One stray network rejection is logged, not allowed to end it.
  process.on("unhandledRejection", (reason) => {
    console.warn(`Ignored a stray network error: ${(reason as Error)?.message ?? String(reason)}`);
  });
  // Node's bundled fetch (undici) can fail an internal assertion when a
  // remote server drops a TLS connection mid-response. It surfaces outside
  // any request's promise; that request then times out and its row records
  // the error. Anything else still ends the run.
  process.on("uncaughtException", (err) => {
    if (/undici/.test(err.stack ?? "")) {
      console.warn(`Ignored a dropped connection: ${err.message}`);
      return;
    }
    console.error(err);
    process.exit(1);
  });
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  try {
    const dir = path.join(process.cwd(), "tmp");
    await mkdir(dir, { recursive: true });
    const file = path.join(dir, `media-report-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.csv`);
    // Written row by row, so an interrupted run still leaves its report.
    await writeFile(file, "id,name,country,logo,logo_source,cover,reason\n");
    const run = args.recheckWideLogos ? recheckWideLogos : enrich;
    const report = await run(prisma, args, (r) =>
      appendFile(file, `${[r.id, r.name, r.country, r.logo, r.logoSource, r.cover, r.reason].map(csv).join(",")}\n`),
    );
    const logos = report.filter((r) => r.logo === "ok").length;
    const covers = report.filter((r) => r.cover === "ok").length;
    console.log(`\n${report.length} institutions: ${logos} logos, ${covers} covers${args.dryRun ? " (dry run, nothing written)" : ""}. Report: ${file}`);
  } finally {
    await prisma.$disconnect();
  }
}

if (isCliEntrypoint(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
