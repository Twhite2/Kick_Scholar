import "dotenv/config";
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { isCliEntrypoint } from "../lib/cliEntrypoint";
import { findDates, parseDaadApplicationPeriods, parseDeadlineText, rollForward } from "../lib/extraction/parsers/dates";
import { parseScholarshipAmount, sectionText } from "../lib/extraction/parsers/amounts";
import { deadlinesFrom, studyModeFromPage } from "../lib/extraction/parsers/daadProgramme";
import { parseCsvTable, pick } from "../lib/ingest/discoverUni/csv";
import { courseShape, degreeLevelFromAward, mergeModes, normaliseUrl } from "../lib/ingest/discoverUni/importDiscoverUni";
import { canonicalizeUrl } from "../lib/normalization/canonicalUrl";

/**
 * Recovers the facts the UI hides for lack of data, from pages and datasets
 * already on disk — no new crawling (docs/ui-remodel-data-gaps.md):
 *
 *   - DAAD programme deadlines and study mode, re-read from the crawled pages
 *     (the old parser kept only the first line of "Application periods");
 *   - DAAD scholarship amounts (the "Value" section; pages quoting several
 *     rates give none) and deadline dates;
 *   - UK course length and study mode from the Discover Uni KISCOURSE.csv;
 *   - annual deadlines that have passed, moved to their next occurrence.
 *
 * Extraction files are patched in place, touching only these fields, so LLM
 * enrichment in them survives. The database gets the same facts directly,
 * because the loader never rewrites existing records. Values already present
 * are never overwritten (deadlines from the same source are replaced, as the
 * loader does).
 *
 *   npm run data:backfill -- [--dry-run] [--verbose] [--no-files] [--no-db] [--kis-dir <dir>]
 *   npm run deadlines:refresh      (only step 4; run it any time, e.g. monthly)
 */

const RAW = path.join(process.cwd(), "data", "raw");
const EXTRACTED = path.join(process.cwd(), "data", "extracted");

interface RawPage {
  url: string;
  checksum: string;
  fetchedAt: Date;
  markdownPath: string;
}

/** Every successfully crawled page of a source, by checksum and newest by URL. */
function indexRaw(sourceId: string) {
  const byChecksum = new Map<string, RawPage>();
  const newestByUrl = new Map<string, RawPage>();
  const root = path.join(RAW, sourceId);
  if (!existsSync(root)) return { byChecksum, newestByUrl };
  for (const run of readdirSync(root).sort()) {
    const dir = path.join(root, run);
    if (!statSync(dir).isDirectory()) continue;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith(".meta.json")) continue;
      let meta: { url?: string; success?: boolean; checksum?: string; fetchedAt?: string; markdownPath?: string };
      try {
        meta = JSON.parse(readFileSync(path.join(dir, f), "utf8"));
      } catch {
        continue;
      }
      if (!meta.success || !meta.url || !meta.checksum || !meta.markdownPath) continue;
      const page: RawPage = { url: meta.url, checksum: meta.checksum, fetchedAt: new Date(meta.fetchedAt ?? Date.now()), markdownPath: meta.markdownPath };
      byChecksum.set(page.checksum, page);
      const prev = newestByUrl.get(page.url);
      if (!prev || prev.fetchedAt < page.fetchedAt) newestByUrl.set(page.url, page);
    }
  }
  return { byChecksum, newestByUrl };
}

const markdownOf = (p: RawPage) => readFileSync(path.join(process.cwd(), p.markdownPath), "utf8");

/** The URL as the loader stores it (normalizeProgram / normalizeScholarship). */
function canonical(url: string): string {
  try {
    return canonicalizeUrl(url);
  } catch {
    return url;
  }
}

/** Newest page per canonical URL ("…/detail/6178/" and "…/detail/6178" are one page). */
function newestByCanonicalUrl(newestByUrl: Map<string, RawPage>): Map<string, RawPage> {
  const out = new Map<string, RawPage>();
  for (const page of newestByUrl.values()) {
    const key = canonical(page.url);
    const prev = out.get(key);
    if (!prev || prev.fetchedAt < page.fetchedAt) out.set(key, page);
  }
  return out;
}

interface Totals {
  [key: string]: number;
}

/** Rewrites an extraction file only if its content changed. */
function writeIfChanged(file: string, before: string, data: unknown, dryRun: boolean): boolean {
  const after = `${JSON.stringify(data, null, 2)}\n`;
  if (after === before) return false;
  if (!dryRun) writeFileSync(file, after);
  return true;
}

function extractionFiles(sourceId: string): string[] {
  const dir = path.join(EXTRACTED, sourceId);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => path.join(dir, f));
}

async function provenance(prisma: PrismaClient, sourceId: string) {
  const source = await prisma.source.findUnique({ where: { id: sourceId }, select: { authorityLevel: true } });
  const authorityLevel = source?.authorityLevel ?? "SECONDARY";
  const primary = authorityLevel === "PRIMARY";
  return {
    primarySourceId: sourceId,
    authorityLevel,
    confidence: primary ? 1 : authorityLevel === "SECONDARY" ? 0.75 : 0.5,
    verified: primary,
    verificationStatus: primary ? ("VERIFIED" as const) : ("UNVERIFIED" as const),
    lastVerifiedAt: primary ? new Date() : null,
  };
}

// ---------------------------------------------------------------------------
// 1. DAAD programmes: deadlines and study mode
// ---------------------------------------------------------------------------

async function daadProgrammes(prisma: PrismaClient, opts: Options, t: Totals) {
  const sourceId = "src-daad-programmes";
  const { byChecksum, newestByUrl } = indexRaw(sourceId);
  const now = new Date();

  if (opts.files) {
    for (const file of extractionFiles(sourceId)) {
      const before = readFileSync(file, "utf8");
      const data = JSON.parse(before);
      const program = data.programs?.[0];
      const page = byChecksum.get(String(data.sourceDocumentId ?? "").split(":")[1] ?? "");
      if (!program || !page) continue;
      const md = markdownOf(page);
      const periods = parseDaadApplicationPeriods(md, page.fetchedAt);
      if (periods.found) {
        const textBefore = program.deadlines?.find((d: { dateText?: string | null }) => d.dateText)?.dateText ?? null;
        program.deadlines = deadlinesFrom(periods, textBefore);
      }
      const mode = studyModeFromPage(md);
      if (!program.studyMode && mode) program.studyMode = mode;
      if (writeIfChanged(file, before, data, opts.dryRun)) t.programmeFilesPatched += 1;
    }
  }

  if (opts.db) {
    const prov = await provenance(prisma, sourceId);
    for (const [url, page] of newestByCanonicalUrl(newestByUrl)) {
      const md = markdownOf(page);
      const periods = parseDaadApplicationPeriods(md, page.fetchedAt);
      const studyMode = studyModeFromPage(md);
      const programmes = await prisma.program.findMany({
        where: { programUrl: { in: [url, page.url] }, primarySourceId: sourceId },
        select: { id: true, studyMode: true },
      });
      for (const p of programmes) {
        if (periods.found) {
          const deadlines = deadlinesFrom(periods, null);
          if (!opts.dryRun) {
            await prisma.applicationDeadline.deleteMany({ where: { programId: p.id, primarySourceId: sourceId } });
            for (const d of deadlines) {
              await prisma.applicationDeadline.create({
                data: {
                  programId: p.id,
                  deadlineType: "APPLICATION",
                  date: d.date ? rollForward(new Date(d.date), d.dateText, now) : null,
                  dateText: d.dateText,
                  intake: d.intake,
                  sourceUrl: url,
                  ...prov,
                },
              });
            }
          }
          t.programmesWithDates += deadlines.some((d) => d.date) ? 1 : 0;
          t.programmeDeadlinesWritten += deadlines.filter((d) => d.date).length;
        }
        if (!p.studyMode && studyMode) {
          if (!opts.dryRun) await prisma.program.update({ where: { id: p.id }, data: { studyMode } });
          t.programmeStudyModes += 1;
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 2. Scholarships: amounts and DAAD deadline dates
// ---------------------------------------------------------------------------

/**
 * DAAD only: each of its pages is one scholarship with its own "Value"
 * section. The other scholarship sources crawl as whole site pages
 * (overviews, rent and fee tables, lists of several programmes), where a
 * figure on the page is rarely the amount of the record built from it.
 */
const SCHOLARSHIP_SOURCES = ["src-daad"];

function amountFromPage(md: string) {
  const value = sectionText(md, /^Value$/i);
  return value ? parseScholarshipAmount(value) : null;
}

async function scholarships(prisma: PrismaClient, opts: Options, t: Totals) {
  const now = new Date();
  for (const sourceId of SCHOLARSHIP_SOURCES) {
    const { byChecksum, newestByUrl } = indexRaw(sourceId);

    if (opts.files) {
      for (const file of extractionFiles(sourceId)) {
        const before = readFileSync(file, "utf8");
        const data = JSON.parse(before);
        // A page listing several scholarships states figures for different
        // awards; only a page that is one scholarship's own gives its amount.
        const s = data.scholarships?.length === 1 ? data.scholarships[0] : null;
        const page = byChecksum.get(String(data.sourceDocumentId ?? "").split(":")[1] ?? "");
        if (!s || !page) continue;
        if (s.amount === null || s.amount === undefined) {
          const stated = amountFromPage(markdownOf(page));
          if (stated) Object.assign(s, { amount: stated.amount, amountCurrency: stated.currency, amountPeriod: stated.period });
        }
        if (sourceId === "src-daad" && (!s.deadlines || s.deadlines.length === 0) && s.deadlineText) {
          s.deadlines = parseDeadlineText(s.deadlineText, page.fetchedAt).map((d) => ({
            deadlineType: "SCHOLARSHIP_APPLICATION",
            date: d.date,
            dateText: d.dateText,
            intake: d.intake,
            sourceQuote: d.sourceQuote,
            sourceUrl: null,
          }));
        }
        if (writeIfChanged(file, before, data, opts.dryRun)) t.scholarshipFilesPatched += 1;
      }
    }

    if (opts.db) {
      const prov = await provenance(prisma, sourceId);
      for (const [url, page] of newestByCanonicalUrl(newestByUrl)) {
        const urls = [...new Set([url, page.url])];
        const records = await prisma.scholarship.findMany({
          where: { OR: [{ sourceUrl: { in: urls } }, { applicationUrl: { in: urls } }], primarySourceId: sourceId },
          select: { id: true, name: true, amount: true, deadlineText: true },
          take: 2,
        });
        if (records.length !== 1) {
          if (records.length > 1) t.scholarshipPagesShared += 1;
          continue;
        }
        const record = records[0];
        const md = markdownOf(page);
        if (record.amount === null) {
          const stated = amountFromPage(md);
          if (stated) {
            if (opts.verbose) console.log(`  amount  ${String(stated.amount).padStart(7)} ${stated.currency} ${String(stated.period ?? "").padEnd(5)} ${record.name.slice(0, 60)}\n          "${stated.quote.slice(0, 140)}"`);
            if (!opts.dryRun) {
              await prisma.scholarship.update({
                where: { id: record.id },
                data: { amount: stated.amount, amountCurrency: stated.currency, amountPeriod: stated.period },
              });
            }
            t.scholarshipAmounts += 1;
          }
        }
        if (sourceId === "src-daad" && record.deadlineText) {
          const dated = parseDeadlineText(record.deadlineText, page.fetchedAt);
          if (dated.length > 0) {
            if (opts.verbose) console.log(`  dates   ${dated.map((d) => `${d.date.slice(0, 10)}${d.intake ? ` (${d.intake})` : ""}`).join(", ")}  ${record.name.slice(0, 50)}\n          "${record.deadlineText.slice(0, 140)}"`);
            if (!opts.dryRun) {
              await prisma.applicationDeadline.deleteMany({ where: { scholarshipId: record.id, primarySourceId: sourceId } });
              for (const d of dated) {
                await prisma.applicationDeadline.create({
                  data: {
                    scholarshipId: record.id,
                    deadlineType: "SCHOLARSHIP_APPLICATION",
                    date: rollForward(new Date(d.date), d.dateText, now),
                    dateText: d.dateText,
                    intake: d.intake,
                    sourceUrl: url,
                    ...prov,
                  },
                });
              }
            }
            t.scholarshipsWithDates += 1;
          }
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 3. UK courses: length and study mode from the Discover Uni release
// ---------------------------------------------------------------------------

function findCsvFile(dir: string, name: string): string | null {
  const hit = readdirSync(dir).find((f) => f.toUpperCase() === `${name}.CSV`);
  return hit ? path.join(dir, hit) : null;
}

async function discoverUni(prisma: PrismaClient, opts: Options, t: Totals) {
  if (!opts.kisDir) return;
  const coursesFile = findCsvFile(opts.kisDir, "KISCOURSE");
  if (!coursesFile) {
    console.warn(`KISCOURSE.csv not found in ${opts.kisDir}; skipping UK courses.`);
    return;
  }
  const courses = parseCsvTable(readFileSync(coursesFile, "utf8"));
  const awardFile = findCsvFile(opts.kisDir, "KISAIM");
  const awardLabel = new Map<string, string>();
  if (awardFile) {
    for (const row of parseCsvTable(readFileSync(awardFile, "utf8")).rows) {
      const code = pick(row, "KISAIMCODE");
      const label = pick(row, "KISAIMLABEL", "LABEL");
      if (code && label) awardLabel.set(code, label);
    }
  }

  // The importer kept one programme per provider, title and degree level,
  // merging the release's full-time and part-time rows into it under the first
  // row's URL. Group the same way, then key each group by the URL the loader
  // stored (canonicalised) and the title.
  type Shape = { studyMode: string | null; durationMonths: number | null };
  const groups = new Map<string, { shape: Shape; urls: Set<string>; title: string }>();
  for (const row of courses.rows) {
    const ukprn = pick(row, "UKPRN", "PUBUKPRN");
    const title = pick(row, "TITLE", "ENGTITLE", "COURSETITLE", "KISCOURSETITLE");
    const raw = normaliseUrl(pick(row, "CRSEURL", "COURSEURL", "URL"));
    const level = degreeLevelFromAward(awardLabel.get(pick(row, "KISAIMCODE")) ?? "");
    if (!ukprn || !title || !raw || !level) continue;
    const key = `${ukprn}|${title}|${level}`;
    const shape = courseShape(row);
    const group = groups.get(key);
    if (group) {
      group.shape = { studyMode: mergeModes(group.shape.studyMode, shape.studyMode), durationMonths: group.shape.durationMonths ?? shape.durationMonths };
      group.urls.add(canonical(raw));
    } else {
      groups.set(key, { shape, urls: new Set([canonical(raw)]), title });
    }
  }
  const shapes = new Map<string, Shape | "ambiguous">();
  for (const { shape, urls, title } of groups.values()) {
    for (const url of urls) {
      const key = `${url}|${title.trim().toLowerCase()}`;
      const prev = shapes.get(key);
      // One URL and title shared by two courses (e.g. two awards) with
      // different shapes: claim neither rather than guess.
      if (prev && (prev === "ambiguous" || prev.studyMode !== shape.studyMode || prev.durationMonths !== shape.durationMonths)) {
        shapes.set(key, "ambiguous");
      } else {
        shapes.set(key, shape);
      }
    }
  }

  const programmes = await prisma.program.findMany({
    where: { primarySourceId: "src-discover-uni", OR: [{ durationMonths: null }, { studyMode: null }] },
    select: { id: true, name: true, programUrl: true, durationMonths: true, studyMode: true },
  });
  for (const p of programmes) {
    const shape = shapes.get(`${canonical(p.programUrl)}|${p.name.trim().toLowerCase()}`);
    if (shape === "ambiguous") {
      t.ukAmbiguous += 1;
      continue;
    }
    if (!shape) continue;
    const data: Record<string, unknown> = {};
    if (p.durationMonths === null && shape.durationMonths !== null) data.durationMonths = shape.durationMonths;
    if (p.studyMode === null && shape.studyMode !== null) data.studyMode = shape.studyMode;
    if (Object.keys(data).length === 0) continue;
    if (!opts.dryRun && opts.db) await prisma.program.update({ where: { id: p.id }, data });
    if (data.durationMonths) t.ukDurations += 1;
    if (data.studyMode) t.ukStudyModes += 1;
  }
}

// ---------------------------------------------------------------------------
// 4. Annual deadlines that have passed
// ---------------------------------------------------------------------------

/** Moves passed annual deadlines (no year in their wording) to the next occurrence. */
export async function refreshAnnualDeadlines(prisma: PrismaClient, dryRun = false): Promise<number> {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const passed = await prisma.applicationDeadline.findMany({
    where: { date: { lt: today } },
    select: { id: true, date: true, dateText: true },
  });
  let moved = 0;
  for (const d of passed) {
    if (!d.date || findDates(d.dateText ?? "").length === 0) continue;
    const next = rollForward(d.date, d.dateText, now);
    if (next.getTime() === d.date.getTime()) continue;
    if (!dryRun) await prisma.applicationDeadline.update({ where: { id: d.id }, data: { date: next } });
    moved += 1;
  }
  return moved;
}

// ---------------------------------------------------------------------------

interface Options {
  dryRun: boolean;
  files: boolean;
  db: boolean;
  kisDir: string | null;
  refreshOnly: boolean;
  /** Print each scholarship amount and date with the wording it came from. */
  verbose: boolean;
}

function parseArgs(argv: string[]): Options {
  const i = argv.indexOf("--kis-dir");
  const kisDir = i >= 0 ? argv[i + 1] : (readdirSync(process.cwd()).find((d) => /^on_\d{4}_/.test(d) && statSync(d).isDirectory()) ?? null);
  return {
    dryRun: argv.includes("--dry-run"),
    files: !argv.includes("--no-files"),
    db: !argv.includes("--no-db"),
    kisDir: kisDir ? path.resolve(kisDir) : null,
    refreshOnly: argv.includes("--refresh-only"),
    verbose: argv.includes("--verbose"),
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  const t: Totals = {
    programmeFilesPatched: 0,
    programmesWithDates: 0,
    programmeDeadlinesWritten: 0,
    programmeStudyModes: 0,
    scholarshipFilesPatched: 0,
    scholarshipAmounts: 0,
    scholarshipsWithDates: 0,
    scholarshipPagesShared: 0,
    ukDurations: 0,
    ukStudyModes: 0,
    ukAmbiguous: 0,
    annualDeadlinesMoved: 0,
  };
  try {
    if (opts.refreshOnly) {
      const moved = await refreshAnnualDeadlines(prisma, opts.dryRun);
      console.log(`${moved} passed annual deadline(s) moved to their next occurrence.`);
      return;
    }
    await daadProgrammes(prisma, opts, t);
    await scholarships(prisma, opts, t);
    await discoverUni(prisma, opts, t);
    if (opts.db) t.annualDeadlinesMoved = await refreshAnnualDeadlines(prisma, opts.dryRun);
    console.log(`${opts.dryRun ? "Dry run: nothing written.\n" : ""}${Object.entries(t).map(([k, v]) => `  ${k.padEnd(28)} ${v}`).join("\n")}`);
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
