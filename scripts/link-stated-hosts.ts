import "dotenv/config";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { isCliEntrypoint } from "../lib/cliEntrypoint";
import { writeExplicitLinks, type StatedLink } from "../lib/linking/explicitLinks";

/**
 * Links an award to the institution its own page says hosts it.
 *
 * Chevening's fellowship pages state their host in one line ("Hosted by the
 * London School of Economics and Political Science (LSE)"). That is a fact
 * the source states, so it becomes an explicit link, shown as "Officially
 * linked", rather than one inferred from a country rule. Only an exact
 * institution name counts; a host that is not an institution in the
 * catalogue (the British Library) is reported, never guessed.
 *
 *   npx tsx scripts/link-stated-hosts.ts [--dry-run]
 */

const SOURCES = ["src-chevening"];

/** Newest crawled markdown per page URL. */
function pagesOf(sourceId: string): Map<string, string> {
  const out = new Map<string, { at: number; md: string }>();
  const root = path.join(process.cwd(), "data", "raw", sourceId);
  if (!existsSync(root)) return new Map();
  for (const run of readdirSync(root)) {
    const dir = path.join(root, run);
    if (!statSync(dir).isDirectory()) continue;
    for (const f of readdirSync(dir).filter((n) => n.endsWith(".meta.json"))) {
      const meta = JSON.parse(readFileSync(path.join(dir, f), "utf8")) as { url?: string; success?: boolean; markdownPath?: string; fetchedAt?: string };
      if (!meta.success || !meta.url || !meta.markdownPath) continue;
      const at = Date.parse(meta.fetchedAt ?? "") || 0;
      const prev = out.get(meta.url);
      if (!prev || prev.at < at) out.set(meta.url, { at, md: meta.markdownPath });
    }
  }
  return new Map([...out].map(([url, v]) => [url, v.md]));
}

/** "the London School of Economics and Political Science (LSE)" -> candidate names to look up. */
export function hostNames(line: string): string[] {
  const name = line.replace(/^the\s+/i, "").trim();
  const bare = name.replace(/\s*\([^)]*\)\s*$/, "").trim();
  return [...new Set([name, bare])].filter(Boolean);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  try {
    const links: StatedLink[] = [];
    const unmatched: string[] = [];
    for (const sourceId of SOURCES) {
      const pages = pagesOf(sourceId);
      const scholarships = await prisma.scholarship.findMany({
        where: { primarySourceId: sourceId, verificationStatus: { not: "REJECTED" } },
        select: { id: true, name: true, sourceUrl: true, country: true },
      });
      for (const s of scholarships) {
        const mdPath = pages.get(s.sourceUrl);
        if (!mdPath) continue;
        const md = readFileSync(path.join(process.cwd(), mdPath), "utf8");
        const line = md.match(/^\s*Hosted by\s+(.+?)\s*$/m)?.[1];
        if (!line) continue;
        let universityId: string | null = null;
        for (const name of hostNames(line)) {
          const hit = await prisma.university.findFirst({
            where: { name: { equals: name, mode: "insensitive" }, ...(s.country ? { country: s.country } : {}) },
            select: { id: true },
          });
          if (hit) {
            universityId = hit.id;
            break;
          }
        }
        if (!universityId) {
          unmatched.push(`${s.name}: hosted by ${line}`);
          continue;
        }
        links.push({ scholarshipId: s.id, universityId, fundingType: "PARTNER_FUNDING", sourceId, sourceUrl: s.sourceUrl, quote: `Hosted by ${line}` });
      }
    }
    const result = await writeExplicitLinks(prisma, links, { dryRun });
    console.log(`${dryRun ? "Dry run: nothing written.\n" : ""}  explicit links      ${result.written} (${result.upgraded} upgraded from inferred)`);
    if (unmatched.length) console.log(`  hosts not in the catalogue:\n${unmatched.map((u) => `    - ${u}`).join("\n")}`);
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
