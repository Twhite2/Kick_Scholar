/**
 * Adds nationally set deadlines (lib/deadlines/national.ts) to every
 * programme they govern, in the database DATABASE_URL names.
 *
 *   npm run deadlines:national -- [--dry-run]
 *
 * Today: UCAS's 2027-entry dates for full-time UK undergraduate courses.
 * Each run first removes the dates it added before, so re-running, or
 * running after the rules change for a new year, never duplicates them.
 * Dates are cited to UCAS's page and marked as applied by rule
 * (confidence 0.8) rather than read from each course's own page.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { UCAS_DATES_URL, UCAS_SOURCE_ID, ucasDeadlinesFor } from "../lib/deadlines/national";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    if (!dryRun) {
      await prisma.source.upsert({
        where: { id: UCAS_SOURCE_ID },
        update: {},
        create: {
          id: UCAS_SOURCE_ID,
          name: "UCAS: dates and deadlines for undergraduate applications",
          type: "NATIONAL_EDUCATION_PORTAL",
          country: "GB",
          baseUrl: UCAS_DATES_URL,
          authorityLevel: "PRIMARY",
          status: "PAUSED",
          notes: "Not crawled. The national application calendar, applied by rule to full-time UK undergraduate courses (npm run deadlines:national).",
        },
      });
    }

    const programmes = await prisma.program.findMany({
      where: { university: { country: "GB" } },
      select: { id: true, name: true, degreeLevel: true, studyMode: true, university: { select: { name: true, country: true } } },
    });

    const rows = programmes.flatMap((p) =>
      ucasDeadlinesFor({
        name: p.name,
        degreeLevel: p.degreeLevel,
        studyMode: p.studyMode,
        country: p.university.country,
        universityName: p.university.name,
      }).map((d) => ({
        programId: p.id,
        deadlineType: "APPLICATION" as const,
        date: d.date,
        dateText: d.dateText,
        intake: d.intake,
        primarySourceId: UCAS_SOURCE_ID,
        sourceUrl: UCAS_DATES_URL,
        authorityLevel: "PRIMARY" as const,
        confidence: 0.8,
      })),
    );
    const governed = new Set(rows.map((r) => r.programId)).size;
    const early = rows.filter((r) => r.dateText.startsWith("15 October")).length;

    console.log(`UK programmes: ${programmes.length}; governed by UCAS: ${governed} (${early} on the 15 October date)`);
    console.log(`Deadlines to write: ${rows.length}`);
    if (dryRun) {
      console.log("Dry run: nothing written.");
      return;
    }

    const removed = await prisma.applicationDeadline.deleteMany({ where: { primarySourceId: UCAS_SOURCE_ID } });
    let written = 0;
    for (let i = 0; i < rows.length; i += 1000) {
      written += (await prisma.applicationDeadline.createMany({ data: rows.slice(i, i + 1000) })).count;
    }
    console.log(`Removed ${removed.count} earlier UCAS dates; wrote ${written}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
