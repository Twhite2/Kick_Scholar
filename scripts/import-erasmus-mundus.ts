import "dotenv/config";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { isCliEntrypoint } from "../lib/cliEntrypoint";
import { loadExtractedFile } from "../lib/pipeline/loadExtractedToDb";
import { canonicalizeUrl } from "../lib/normalization/canonicalUrl";
import { inferFieldCategory } from "../lib/extraction/parsers/fieldCategory";
import { writeExplicitLinks, type StatedLink } from "../lib/linking/explicitLinks";
import type { ExtractionFile } from "../lib/extraction/schemas";

/**
 * Erasmus Mundus Joint Masters as programmes, with their consortia.
 *
 * Every Erasmus Mundus scholarship belongs to one joint master's, taught by
 * a consortium of universities. The EACEA catalogue we crawl gives each
 * programme's name, website and Erasmus+ project number; the Commission's
 * project lists give the coordinator and partners (name, country, website).
 *
 * Input: the Key Action 1 project lists for 2021 onwards (CSV), downloaded
 * from https://erasmus-plus.ec.europa.eu/projects/projects-lists into
 * data/erasmus-plus/. The Commission's file server refuses automated
 * downloads, so they are fetched in a browser.
 *
 * For each programme:
 *   - every organisation is resolved to a catalogue institution by its
 *     website, else by exact name within its country; nothing is guessed,
 *     and organisations not in the catalogue are reported by country;
 *   - the programme is created at the coordinator: MASTER, its own name and
 *     website, and nothing the lists do not state (length, language, fees
 *     stay unknown);
 *   - explicit links tie the scholarship to that programme and to every
 *     partner institution ("Officially linked" in the UI).
 *
 *   npm run data:erasmus-mundus -- [--dir data/erasmus-plus] [--dry-run]
 */

const SOURCE_ID = "src-erasmus-mundus";

// ---------------------------------------------------------------------------
// Reading the project lists
// ---------------------------------------------------------------------------

/** RFC 4180 rows with the delimiter the file uses (the Commission's exports vary). */
export function parseDelimited(text: string): string[][] {
  const firstLine = text.slice(0, text.indexOf("\n") >>> 0);
  const delim = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === delim) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((v) => v.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  row.push(cell);
  if (row.some((v) => v.trim() !== "")) rows.push(row);
  return rows;
}

export interface ProjectColumns {
  id: number;
  coordinator: { name: number; country: number; website: number };
  partners: Array<{ n: number; name: number; country: number; website: number }>;
}

/** Column positions, found by header wording rather than fixed order. */
export function projectColumns(headers: string[]): ProjectColumns | null {
  const h = headers.map((x) => x.trim().replace(/^﻿/, ""));
  const find = (...res: RegExp[]) => {
    for (const re of res) {
      const i = h.findIndex((x) => re.test(x));
      if (i >= 0) return i;
    }
    return -1;
  };
  const id = find(/^project (identifier|number|id)$/i, /project.*(identifier|number)/i);
  const coordinator = {
    name: find(/^coordinating organisation name$/i, /coordinat\w*.*\bname\b/i),
    country: find(/^coordinator'?s? country$/i, /coordinat\w*.*\bcountry\b/i),
    website: find(/^coordinator'?s? website$/i, /coordinat\w*.*\bweb\s?site\b/i),
  };
  if (id < 0 || coordinator.name < 0) return null;
  const partners: ProjectColumns["partners"] = [];
  for (let n = 1; n <= 60; n++) {
    const name = find(new RegExp(`^partner ${n} name$`, "i"));
    if (name < 0) continue;
    partners.push({
      n,
      name,
      country: find(new RegExp(`^partner ${n} country$`, "i")),
      website: find(new RegExp(`^partner ${n} web\\s?site$`, "i")),
    });
  }
  return { id, coordinator, partners };
}

/** "https://erasmus-plus.ec.europa.eu/projects/search/details/101082651" -> "101082651". */
export function projectNumberOf(url: string | null | undefined): string | null {
  return url?.match(/\/details\/(\d{6,})/)?.[1] ?? null;
}

export interface Organisation {
  role: "coordinator" | "partner";
  name: string;
  country: string | null;
  website: string | null;
}

let regionNames: Intl.DisplayNames | null = null;
let codeByName: Map<string, string> | null = null;

/** "IT", "Italy" or "ITALY" -> "IT". Greece's EU code EL is ISO GR. */
export function countryCode(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (/^[A-Za-z]{2}$/.test(v)) return v.toUpperCase() === "EL" ? "GR" : v.toUpperCase();
  if (!codeByName) {
    regionNames = new Intl.DisplayNames(["en"], { type: "region" });
    codeByName = new Map();
    for (let a = 65; a <= 90; a++) {
      for (let b = 65; b <= 90; b++) {
        const code = String.fromCharCode(a, b);
        try {
          const name = regionNames.of(code);
          if (name && name !== code) codeByName.set(name.toLowerCase(), code);
        } catch {
          // not a region code
        }
      }
    }
    codeByName.set("czech republic", "CZ").set("turkey", "TR").set("türkiye", "TR").set("republic of korea", "KR");
  }
  return codeByName.get(v.toLowerCase()) ?? null;
}

export function organisationsOf(row: string[], cols: ProjectColumns): Organisation[] {
  const cell = (i: number) => (i >= 0 ? (row[i] ?? "").trim() : "");
  const out: Organisation[] = [];
  const coordinatorName = cell(cols.coordinator.name);
  if (coordinatorName) {
    out.push({ role: "coordinator", name: coordinatorName, country: countryCode(cell(cols.coordinator.country)), website: cell(cols.coordinator.website) || null });
  }
  for (const p of cols.partners) {
    const name = cell(p.name);
    if (name) out.push({ role: "partner", name, country: countryCode(cell(p.country)), website: cell(p.website) || null });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Resolving organisations to institutions
// ---------------------------------------------------------------------------

/** "https://www.unibo.it/en" -> "unibo.it". */
export function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const host = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.toLowerCase();
    return host.replace(/^www\d?\./, "") || null;
  } catch {
    return null;
  }
}

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

interface UniversityIndex {
  byHost: Map<string, string>;
  byName: Map<string, string>;
  names: Map<string, string>;
}

async function universityIndex(prisma: PrismaClient): Promise<UniversityIndex> {
  const rows = await prisma.university.findMany({ select: { id: true, name: true, country: true, website: true, domain: true } });
  const byHost = new Map<string, string>();
  const byName = new Map<string, string>();
  const names = new Map<string, string>();
  for (const u of rows) {
    names.set(u.id, u.name);
    for (const h of [hostOf(u.website), u.domain?.toLowerCase().replace(/^www\./, "") ?? null]) if (h && !byHost.has(h)) byHost.set(h, u.id);
    byName.set(`${fold(u.name)}|${u.country}`, u.id);
  }
  return { byHost, byName, names };
}

export function resolveOrganisation(org: Organisation, index: Pick<UniversityIndex, "byHost" | "byName">): string | null {
  const host = hostOf(org.website);
  if (host) {
    // "www.en.unibo.it" and "unibo.it" are the same institution: try each parent domain down to two labels.
    const labels = host.split(".");
    for (let i = 0; i <= labels.length - 2; i++) {
      const hit = index.byHost.get(labels.slice(i).join("."));
      if (hit) return hit;
    }
  }
  if (org.country) return index.byName.get(`${fold(org.name)}|${org.country}`) ?? null;
  return null;
}

// ---------------------------------------------------------------------------

interface Options {
  dir: string;
  dryRun: boolean;
}

export async function importErasmusMundus(prisma: PrismaClient, opts: Options) {
  if (!existsSync(opts.dir)) throw new Error(`No project lists in ${opts.dir}. Download the Key Action 1 CSVs (2021 onwards) from https://erasmus-plus.ec.europa.eu/projects/projects-lists into that folder.`);
  const projects = new Map<string, Organisation[]>();
  const headerProblems: string[] = [];
  for (const file of readdirSync(opts.dir).filter((f) => /\.csv$/i.test(f))) {
    const rows = parseDelimited(readFileSync(path.join(opts.dir, file), "utf8"));
    const cols = rows[0] ? projectColumns(rows[0]) : null;
    if (!cols) {
      headerProblems.push(`${file}: no project number or coordinator column in [${(rows[0] ?? []).slice(0, 12).join(" | ")}]`);
      continue;
    }
    for (const row of rows.slice(1)) {
      const id = (row[cols.id] ?? "").trim();
      if (id) projects.set(id, organisationsOf(row, cols));
    }
  }

  const scholarships = await prisma.scholarship.findMany({
    where: { primarySourceId: SOURCE_ID, verificationStatus: { not: "REJECTED" } },
    select: { id: true, name: true, applicationUrl: true, sourceUrl: true, officialSourceUrl: true, description: true },
  });
  const index = await universityIndex(prisma);

  const extraction: ExtractionFile = {
    sourceId: SOURCE_ID,
    sourceDocumentId: `${SOURCE_ID}:emjm-consortia`,
    extractedBy: "manual",
    extractedAt: new Date().toISOString(),
    universities: [],
    programs: [],
    scholarships: [],
  };
  const plans: Array<{ scholarshipId: string; coordinatorId: string; programUrl: string; partnerIds: string[]; quote: string }> = [];
  const missing = new Map<string, Set<string>>();
  const totals = { scholarships: scholarships.length, withProjectNumber: 0, foundInLists: 0, coordinatorsResolved: 0, partnersResolved: 0, partnersUnresolved: 0 };

  for (const s of scholarships) {
    const number = projectNumberOf(s.officialSourceUrl);
    if (!number) continue;
    totals.withProjectNumber += 1;
    const orgs = projects.get(number);
    if (!orgs) continue;
    totals.foundInLists += 1;

    const resolved = orgs.map((o) => ({ org: o, universityId: resolveOrganisation(o, index) }));
    for (const r of resolved) {
      if (r.universityId) continue;
      const key = r.org.country ?? "??";
      if (!missing.has(key)) missing.set(key, new Set());
      missing.get(key)!.add(r.org.name);
    }
    const coordinator = resolved.find((r) => r.org.role === "coordinator");
    const partnerIds = [...new Set(resolved.filter((r) => r.org.role === "partner" && r.universityId).map((r) => r.universityId!))];
    totals.partnersResolved += partnerIds.length;
    totals.partnersUnresolved += resolved.filter((r) => r.org.role === "partner" && !r.universityId).length;
    if (!coordinator?.universityId) continue;
    totals.coordinatorsResolved += 1;

    const consortium = orgs.map((o) => `${o.name}${o.role === "coordinator" ? " (coordinator)" : ""}`);
    const countries = [...new Set(orgs.map((o) => o.country).filter(Boolean))];
    const programUrl = canonicalizeUrl(s.applicationUrl);
    extraction.programs.push({
      universityName: index.names.get(coordinator.universityId)!,
      universityWebsite: programUrl,
      name: s.name,
      degreeLevel: "MASTER",
      fieldOfStudy: s.name,
      fieldCategory: (inferFieldCategory(s.name) ?? "OTHER") as never,
      durationMonths: null,
      instructionLanguages: [],
      tuitionType: "UNKNOWN",
      tuitionAmount: null,
      tuitionCurrency: null,
      tuitionPeriod: null,
      intakes: [],
      studyMode: null,
      programUrl,
      description: `Erasmus Mundus Joint Master, taught by ${orgs.length} institutions in ${countries.length} countries: ${consortium.join(", ")}.`,
      sourceUrl: s.sourceUrl,
      sourceQuote: s.name,
      requirements: [],
      deadlines: [],
    });
    plans.push({ scholarshipId: s.id, coordinatorId: coordinator.universityId, programUrl, partnerIds: partnerIds.filter((id) => id !== coordinator.universityId), quote: `Consortium: ${consortium.join(", ")}` });
  }

  let load = null;
  let links = { written: 0, upgraded: 0 };
  if (!opts.dryRun && extraction.programs.length > 0) {
    const dir = path.join(process.cwd(), "data", "extracted", SOURCE_ID);
    await mkdir(dir, { recursive: true });
    const file = path.join(dir, `${SOURCE_ID}_emjm-consortia.json`);
    await writeFile(file, `${JSON.stringify(extraction, null, 2)}\n`);
    load = await loadExtractedFile(prisma, file);

    const stated: StatedLink[] = [];
    for (const p of plans) {
      const program = await prisma.program.findFirst({ where: { programUrl: p.programUrl, universityId: p.coordinatorId }, select: { id: true } });
      stated.push({ scholarshipId: p.scholarshipId, universityId: p.coordinatorId, programId: program?.id ?? null, fundingType: "PARTNER_FUNDING", sourceId: SOURCE_ID, sourceUrl: p.programUrl, quote: p.quote });
      for (const partnerId of p.partnerIds) {
        stated.push({ scholarshipId: p.scholarshipId, universityId: partnerId, programId: null, fundingType: "PARTNER_FUNDING", sourceId: SOURCE_ID, sourceUrl: p.programUrl, quote: p.quote });
      }
    }
    links = await writeExplicitLinks(prisma, stated);
  } else if (opts.dryRun) {
    links.written = plans.reduce((n, p) => n + 1 + p.partnerIds.length, 0);
  }

  return { totals, headerProblems, missing, programmes: extraction.programs.length, load, links };
}

async function main() {
  const argv = process.argv.slice(2);
  const i = argv.indexOf("--dir");
  const opts: Options = { dir: path.resolve(i >= 0 ? argv[i + 1] : path.join("data", "erasmus-plus")), dryRun: argv.includes("--dry-run") };
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  try {
    const r = await importErasmusMundus(prisma, opts);
    if (r.headerProblems.length) console.warn(`Files not read:\n${r.headerProblems.map((p) => `  - ${p}`).join("\n")}`);
    console.log(`${opts.dryRun ? "Dry run: nothing written.\n" : ""}${Object.entries(r.totals).map(([k, v]) => `  ${k.padEnd(22)} ${v}`).join("\n")}\n  programmes             ${r.programmes}\n  explicit links         ${r.links.written}`);
    if (r.load) console.log(`  loaded: ${r.load.programsCreated} created, ${r.load.programsMerged} merged`);
    const missing = [...r.missing].sort((a, b) => b[1].size - a[1].size);
    if (missing.length) {
      console.log("  organisations not in the catalogue, by country (import them from ROR, then re-run):");
      for (const [country, names] of missing.slice(0, 25)) console.log(`    ${country} ${names.size}`);
    }
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
