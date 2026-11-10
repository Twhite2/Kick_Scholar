import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { isCliEntrypoint } from "../lib/cliEntrypoint";
import { getMediaStore } from "../lib/media/store";
import { coverRejection, processCover, processLogo } from "../lib/media/process";
import { download, fetchCommonsImage, fetchLogoDev, fetchRor, fetchWikidata, userAgent } from "../lib/media/sources";

/**
 * Finds a logo and a campus photo for each institution and caches them on our
 * own storage, keeping the photo's credit and licence (docs/ui-remodel.md §11).
 *
 *   npm run media:enrich -- --country FI,SE --limit 50 [--only-missing] [--dry-run] [--force]
 *
 *   --country   ISO codes, comma separated. With several, --limit applies to each.
 *   --limit     Institutions per country (default 50).
 *   --only-missing  Skip institutions that already have both a logo and a cover.
 *   --dry-run   Fetch and check everything, write nothing.
 *   --force     Re-check rows checked in the last 30 days.
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

export async function enrich(prisma: PrismaClient, args: Args): Promise<ReportRow[]> {
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
        ...(args.force ? {} : { OR: [{ logoCheckedAt: null }, { logoCheckedAt: { lt: stale } }] }),
      },
      // Most-linked first: the institutions students see most.
      orderBy: [{ fundingOpportunities: { _count: "desc" } }, { programs: { _count: "desc" } }],
      take: args.limit,
      select: { id: true, name: true, country: true, rorId: true, externalIds: true, acronym: true, domain: true, logoUrl: true, coverUrl: true },
    });

    for (const u of rows) {
      const row: ReportRow = { id: u.id, name: u.name, country: u.country, logo: "none", logoSource: "", cover: "none", reason: "" };
      const reasons: string[] = [];
      const data: Record<string, unknown> = { logoCheckedAt: new Date(), coverCheckedAt: new Date() };
      try {
        const ror = u.rorId ? await fetchRor(u.rorId) : null;
        const stored = (u.externalIds as { wikidata?: string } | null)?.wikidata ?? null;
        const qid = ror?.wikidataId ?? stored;
        if (ror?.acronym && !u.acronym) data.acronym = ror.acronym;
        if (ror?.domain && !u.domain) data.domain = ror.domain;
        if (qid) data.wikidataId = qid;
        const wd = qid ? await fetchWikidata(qid) : null;

        // Logo: Wikidata P154, rasterised by Commons (never serve third-party SVG).
        let logo: Buffer | null = null;
        if (wd?.logoFile) {
          const img = await fetchCommonsImage(wd.logoFile, 512);
          if (img) {
            logo = await download(img.thumbUrl, true);
            row.logoSource = "wikidata";
          }
        }
        if (!logo && (ror?.domain ?? u.domain)) {
          logo = await fetchLogoDev((ror?.domain ?? u.domain)!);
          if (logo) row.logoSource = "logo.dev";
        }
        if (logo) {
          const { w256, w128 } = await processLogo(logo);
          if (!args.dryRun) {
            data.logoUrl = await store.put(`logos/${u.id}-256.webp`, w256, "image/webp");
            await store.put(`logos/${u.id}-128.webp`, w128, "image/webp");
            data.logoSource = row.logoSource;
          }
          row.logo = "ok";
        } else {
          reasons.push(wd ? "no logo on Wikidata" : "no Wikidata item");
        }

        // Cover: Wikidata P18, checked before download.
        if (wd?.imageFile) {
          const img = await fetchCommonsImage(wd.imageFile, 1600);
          const rejected = img
            ? coverRejection({ mime: img.mime, width: img.width, height: img.height, title: img.title, description: img.description })
            : "no image info";
          if (img && !rejected) {
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
          } else {
            row.cover = "rejected";
            reasons.push(`cover ${rejected}`);
          }
        } else {
          reasons.push("no photo on Wikidata");
        }

        if (!args.dryRun) await prisma.university.update({ where: { id: u.id }, data });
      } catch (err) {
        reasons.push(`error: ${(err as Error).message}`);
      }
      row.reason = reasons.join("; ");
      report.push(row);
      console.log(`${row.country} ${row.logo.padEnd(4)} ${row.cover.padEnd(8)} ${u.name}${row.reason ? ` (${row.reason})` : ""}`);
    }
  }
  return report;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  try {
    const report = await enrich(prisma, args);
    const dir = path.join(process.cwd(), "tmp");
    await mkdir(dir, { recursive: true });
    const file = path.join(dir, `media-report-${new Date().toISOString().slice(0, 10)}.csv`);
    const lines = ["id,name,country,logo,logo_source,cover,reason", ...report.map((r) => [r.id, r.name, r.country, r.logo, r.logoSource, r.cover, r.reason].map(csv).join(","))];
    await writeFile(file, `${lines.join("\n")}\n`);
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
