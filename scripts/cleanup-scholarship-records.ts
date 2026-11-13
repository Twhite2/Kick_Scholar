import "dotenv/config";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { isCliEntrypoint } from "../lib/cliEntrypoint";
import { AWARD_PAGES, isAwardPage } from "../lib/extraction/parsers/index";
import { NOT_AN_AWARD } from "../lib/scholarships/listed";

/**
 * Takes the records that are website pages, not awards, out of the catalogue.
 *
 * The curated sources (Chevening, Commonwealth, MEXT, Türkiye Burslari) were
 * crawled as whole sites, and every page became a "scholarship": "About us",
 * "Accommodation", "Find a course", a 404 page. For each of those sources,
 * any listed record whose page is not one of its award pages (AWARD_PAGES):
 *
 *   - is merged into its award when the page belongs to one (MERGE_INTO):
 *     the page's dated deadlines move to the award, and any eligibility
 *     criteria the award lacks are listed in the report for review;
 *   - is unlisted: verificationStatus REJECTED, verifiedBy system:not-an-award.
 *     Reversible from the admin screen ("Mark verified"), and the pipeline,
 *     which never overwrites an existing record's status, cannot relist it.
 *
 * Unlisting deletes the record's inferred links and every student's match
 * for it. Saved items and tracked applications stay: My plan shows them as
 * no longer listed. Extraction files are patched so the page records are gone
 * from them too (the loader skips them regardless).
 *
 *   npm run data:cleanup-scholarships -- [--dry-run] [--no-files]
 */

/** Pages that belong to one award: their facts move to it before they are unlisted. */
const MERGE_INTO: Readonly<Record<string, ReadonlyArray<{ page: RegExp; award: RegExp }>>> = {
  "src-chevening": [
    // "Who can apply", "Find a course", the timeline and the 198 country pages all describe the one scholarship.
    { page: /chevening\.org\/(scholarships\/(who-can-apply|find-a-course|application-timeline)|scholarship\/[^/]+)\/?$/, award: /chevening\.org\/scholarships\/?$/ },
  ],
  "src-turkiye-burslari": [
    // The yearly call and the programme's process pages belong to the full-time scholarship.
    {
      page: /turkiyeburslari\.gov\.tr\/(announcements\/turkiye-scholarships-\d{4}-applications[^/]*|scholarshipsprograms|evaluationandselectionprocess|scholarshipsprocess|applysteps)\/?$/,
      award: /turkiyeburslari\.gov\.tr\/fulltimeprograms\/?$/,
    },
    // Earlier calls of the IsDB joint programme belong to the current one.
    { page: /turkiyeburslari\.gov\.tr\/announcements\/ytb-?isdb[^/]*\/?$/i, award: /turkiyeburslari\.gov\.tr\/announcements\/ytb-islamic-development-bank/ },
  ],
};

interface Options {
  dryRun: boolean;
  files: boolean;
}

interface ReportRow {
  source: string;
  name: string;
  url: string;
  action: string;
  links: number;
  matches: number;
  saved: number;
  applications: number;
  deadlinesMoved: number;
  criteriaToReview: string;
}

const csv = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** One line per criterion, comparable across records. */
function criterionKey(c: { criterionType: string; operator: string; numericValue: unknown; textValue: string | null; valueList: string[] }) {
  return [c.criterionType, c.operator, c.numericValue ?? "", (c.textValue ?? "").toLowerCase().replace(/\s+/g, " ").trim(), [...c.valueList].sort().join("|")].join("::");
}

export async function cleanupScholarshipRecords(prisma: PrismaClient, opts: Options) {
  const report: ReportRow[] = [];
  const totals = { unlisted: 0, merged: 0, linksRemoved: 0, matchesRemoved: 0, deadlinesMoved: 0, filesPatched: 0, pageRecordsInFiles: 0 };

  for (const sourceId of Object.keys(AWARD_PAGES)) {
    const records = await prisma.scholarship.findMany({
      where: { primarySourceId: sourceId, verificationStatus: { not: "REJECTED" } },
      select: {
        id: true,
        name: true,
        sourceUrl: true,
        eligibility: { select: { criterionType: true, operator: true, numericValue: true, textValue: true, valueList: true } },
        deadlines: { select: { id: true, date: true, intake: true, dateText: true } },
        _count: { select: { fundingOpportunities: true, matches: true, savedOpportunities: true, applications: true } },
      },
    });
    const awards = records.filter((r) => isAwardPage(sourceId, r.sourceUrl));

    for (const page of records.filter((r) => !isAwardPage(sourceId, r.sourceUrl))) {
      const rule = MERGE_INTO[sourceId]?.find((m) => m.page.test(page.sourceUrl));
      const award = rule ? awards.find((a) => rule.award.test(a.sourceUrl)) : undefined;
      let deadlinesMoved = 0;
      let criteriaToReview: string[] = [];

      if (award) {
        // Dated deadlines the award does not already carry move to it.
        const have = new Set(award.deadlines.map((d) => `${d.date?.toISOString() ?? ""}|${d.intake ?? ""}`));
        const moving = page.deadlines.filter((d) => d.date && !have.has(`${d.date.toISOString()}|${d.intake ?? ""}`));
        if (!opts.dryRun && moving.length > 0) {
          await prisma.applicationDeadline.updateMany({ where: { id: { in: moving.map((d) => d.id) } }, data: { scholarshipId: award.id } });
        }
        deadlinesMoved = moving.length;
        // Criteria are not copied: they would need a person to judge them.
        const awardHas = new Set(award.eligibility.map(criterionKey));
        criteriaToReview = page.eligibility
          .filter((c) => !awardHas.has(criterionKey(c)))
          .map((c) => `${c.criterionType}${c.numericValue !== null ? ` ${c.operator} ${String(c.numericValue)}` : ""}${c.textValue ? `: ${c.textValue.slice(0, 120)}` : ""}${c.valueList.length ? `: ${c.valueList.slice(0, 6).join(", ")}` : ""}`);
      }

      if (!opts.dryRun) {
        await prisma.scholarship.update({
          where: { id: page.id },
          data: { verified: false, verificationStatus: "REJECTED", verifiedBy: NOT_AN_AWARD },
        });
        const links = await prisma.fundingOpportunity.deleteMany({ where: { scholarshipId: page.id, linkMethod: "RULE_INFERENCE" } });
        const matches = await prisma.match.deleteMany({ where: { scholarshipId: page.id } });
        totals.linksRemoved += links.count;
        totals.matchesRemoved += matches.count;
      } else {
        totals.linksRemoved += page._count.fundingOpportunities;
        totals.matchesRemoved += page._count.matches;
      }
      totals.unlisted += 1;
      if (award) totals.merged += 1;
      totals.deadlinesMoved += deadlinesMoved;
      report.push({
        source: sourceId,
        name: page.name,
        url: page.sourceUrl,
        action: award ? `merged into "${award.name}", unlisted` : rule ? "unlisted (award to merge into not found)" : "unlisted",
        links: page._count.fundingOpportunities,
        matches: page._count.matches,
        saved: page._count.savedOpportunities,
        applications: page._count.applications,
        deadlinesMoved,
        criteriaToReview: criteriaToReview.join(" | "),
      });
    }

    // The same pages, out of the extraction files.
    if (opts.files) {
      const dir = path.join(process.cwd(), "data", "extracted", sourceId);
      const names = await readdir(dir).catch(() => [] as string[]);
      for (const name of names.filter((n) => n.endsWith(".json"))) {
        const file = path.join(dir, name);
        const before = await readFile(file, "utf8");
        const data = JSON.parse(before) as { scholarships?: Array<{ sourceUrl: string }> };
        const kept = (data.scholarships ?? []).filter((s) => isAwardPage(sourceId, s.sourceUrl));
        const dropped = (data.scholarships ?? []).length - kept.length;
        if (dropped === 0) continue;
        totals.pageRecordsInFiles += dropped;
        totals.filesPatched += 1;
        if (!opts.dryRun) await writeFile(file, `${JSON.stringify({ ...data, scholarships: kept }, null, 2)}\n`);
      }
    }
  }

  return { totals, report };
}

function parseArgs(argv: string[]): Options {
  return { dryRun: argv.includes("--dry-run"), files: !argv.includes("--no-files") };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  try {
    const { totals, report } = await cleanupScholarshipRecords(prisma, opts);
    const dir = path.join(process.cwd(), "tmp");
    await mkdir(dir, { recursive: true });
    const file = path.join(dir, `scholarship-cleanup-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}${opts.dryRun ? "-dry-run" : ""}.csv`);
    const header = ["source", "name", "url", "action", "links", "matches", "saved", "applications", "deadlines_moved", "criteria_to_review"];
    const lines = [header.join(","), ...report.map((r) => [r.source, r.name, r.url, r.action, r.links, r.matches, r.saved, r.applications, r.deadlinesMoved, r.criteriaToReview].map(csv).join(","))];
    await writeFile(file, `${lines.join("\n")}\n`);
    console.log(`${opts.dryRun ? "Dry run: nothing written.\n" : ""}${Object.entries(totals).map(([k, v]) => `  ${k.padEnd(20)} ${v}`).join("\n")}\nReport: ${file}`);
    if (!opts.dryRun) console.log("Next: npm run link:build, then re-run matching (npm run match:run -- <userId>) for each student.");
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
