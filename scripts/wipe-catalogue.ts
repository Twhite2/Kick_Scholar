import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { isCliEntrypoint } from "../lib/cliEntrypoint";

/**
 * Empties every catalogue and derived table so the database can be rebuilt
 * from a different set of sources.
 *
 * Destructive and not undoable. Take a dump first:
 *
 *   wsl -d Ubuntu-24.04 -u postgres pg_dump -d kickscholar > backup.sql
 *
 * User accounts, sessions and student profiles are deliberately KEPT. They
 * are not catalogue data, nothing in them describes a scholarship, and
 * deleting them would lock you out of your own application for no benefit.
 * Everything that references the catalogue (matches, saved items,
 * applications) is cleared, because those rows point at scholarships and
 * programmes that are about to stop existing.
 *
 *   npm run db:wipe -- --yes
 */

/**
 * Order is irrelevant because this is one TRUNCATE with CASCADE, but the
 * grouping documents what each table is.
 */
const CATALOGUE_TABLES = [
  // The catalogue itself
  "University",
  "Program",
  "ProgramRequirement",
  "Scholarship",
  "ScholarshipEligibility",
  "FundingOpportunity",
  "ApplicationDeadline",
  // Provenance and crawl bookkeeping
  "Source",
  "SourceDocument",
  "SourceCitation",
  "CrawlJob",
  // Derived per-student data that points at the catalogue
  "Match",
  "SavedOpportunity",
  "Application",
  "ApplicationDocument",
];

export interface WipeResult {
  before: Record<string, number>;
  after: Record<string, number>;
}

async function counts(prisma: PrismaClient): Promise<Record<string, number>> {
  const rows = await prisma.$queryRawUnsafe<{ table: string; n: bigint }[]>(
    CATALOGUE_TABLES.map(
      (t) => `SELECT '${t}' AS table, count(*) AS n FROM "${t}"`,
    ).join(" UNION ALL "),
  );
  return Object.fromEntries(rows.map((r) => [r.table, Number(r.n)]));
}

export async function wipeCatalogue(prisma: PrismaClient): Promise<WipeResult> {
  const before = await counts(prisma);
  const quoted = CATALOGUE_TABLES.map((t) => `"${t}"`).join(", ");
  // RESTART IDENTITY so any sequence-backed column starts clean; CASCADE so
  // foreign keys do not have to be unwound by hand.
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`);
  const after = await counts(prisma);
  return { before, after };
}

async function runAsCli() {
  if (!process.argv.includes("--yes")) {
    console.error(
      "Refusing to wipe without --yes.\n\n" +
        "This deletes every university, programme, scholarship, eligibility rule,\n" +
        "funding link, match and saved item. User accounts and profiles are kept.\n" +
        "Take a backup first, then re-run:\n\n" +
        "  npm run db:wipe -- --yes\n",
    );
    process.exit(1);
  }

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });
  try {
    const { before, after } = await wipeCatalogue(prisma);
    const removed = Object.entries(before).filter(([, n]) => n > 0);
    console.log("Wiped:");
    for (const [table, n] of removed.sort((a, b) => b[1] - a[1])) {
      console.log(`  ${table.padEnd(22)} ${n.toLocaleString()} -> ${after[table]}`);
    }
    const leftover = Object.entries(after).filter(([, n]) => n > 0);
    if (leftover.length > 0) {
      console.error("\nTables still holding rows after TRUNCATE:", leftover);
      process.exit(1);
    }
    const users = await prisma.user.count();
    console.log(`\nCatalogue empty. ${users} user account(s) preserved.`);
    console.log("Rebuild with:  npm run sources:sync  then crawl, extract, load, link.");
  } finally {
    await prisma.$disconnect();
  }
}

if (isCliEntrypoint(import.meta.url)) {
  runAsCli().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
