import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { isCliEntrypoint } from "../cliEntrypoint";
import { inferApplicableLinks } from "./inferApplicableLinks";

/**
 * Rebuilds the scholarship -> institution links from the catalogue as it
 * stands right now.
 *
 * Safe to re-run: the inference pass converges on a set rather than appending
 * to one, and it never touches EXPLICIT_SOURCE rows.
 */
async function runAsCli() {
  const args = process.argv.slice(2);
  const flag = (name: string): string | undefined => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const dryRun = args.includes("--dry-run");
  const verbose = args.includes("--verbose");
  const scholarshipId = flag("scholarship-id");
  const limitRaw = flag("limit");

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });
  try {
    const result = await inferApplicableLinks(prisma, {
      dryRun,
      scholarshipId,
      limit: limitRaw ? Number(limitRaw) : undefined,
    });

    console.log(`\n${dryRun ? "[dry run] " : ""}Rule-inferred links:`);
    console.log(`  scholarships considered  ${result.scholarshipsConsidered}`);
    console.log(`  scholarships linked      ${result.scholarshipsLinked}`);
    console.log(`  links written            ${result.linksWritten}`);
    console.log(`  stale links removed      ${result.linksDeleted}`);
    console.log(`\n  Not linked, and why:`);
    console.log(`    no usable rules        ${result.skippedNoRules}  (kept as rules; still matched per student)`);
    console.log(`    too broad for a link   ${result.skippedTooBroad}`);
    console.log(`    no catalogue matches   ${result.skippedNoMatches}`);

    const byLevel = result.outcomes.reduce<Record<string, number>>((acc, o) => {
      if (o.level) acc[o.level] = (acc[o.level] ?? 0) + 1;
      return acc;
    }, {});
    if (Object.keys(byLevel).length) {
      console.log(`\n  Link level chosen:`);
      for (const [level, n] of Object.entries(byLevel)) {
        console.log(`    ${level.padEnd(20)} ${n} scholarship(s)`);
      }
    }

    // Tokens the extractor produced that no predicate could use. A source
    // that trips this often is worth a parser fix, so it is reported rather
    // than swallowed.
    const unresolved = new Map<string, number>();
    for (const o of result.outcomes) {
      for (const t of o.rules.unresolved) unresolved.set(t, (unresolved.get(t) ?? 0) + 1);
    }
    if (unresolved.size) {
      const top = [...unresolved.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
      console.log(`\n  Rule values no predicate could use (${unresolved.size} distinct):`);
      for (const [token, n] of top) console.log(`    ${String(n).padStart(4)}  ${token}`);
    }

    if (verbose) {
      console.log(`\n  Per scholarship:`);
      for (const o of result.outcomes) {
        const where = o.rules.countries.join(",") || "-";
        const detail = o.skipped
          ? `skipped: ${o.skipped}${o.candidateCount ? ` (${o.candidateCount} candidates)` : ""}`
          : `${o.linksWritten} new / ${o.linksDeleted} removed @ ${o.level}`;
        console.log(`    ${o.scholarshipName.slice(0, 60).padEnd(60)} [${where}] ${detail}`);
      }
    }
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
