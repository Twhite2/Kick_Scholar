import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import type { ExtractionFile } from "@/lib/extraction/schemas";
import { inferFieldCategory } from "../../extraction/parsers/fieldCategory";
import { loadExtractedFile } from "../../pipeline/loadExtractedToDb";
import { InstitutionResolver, addFromRor, institutionIndex } from "./resolveInstitution";
import type { RegisterProgramme, RegisterSource } from "./types";

/**
 * A register's programmes into the catalogue, through the same extraction
 * files and loader as every other source: one file per institution, so the
 * loader attaches each programme to its institution by exact name.
 *
 * Rows for one programme (a location or form of study each) merge into one
 * programme; its forms of study are joined.
 */

const MODE_ORDER = ["Full-time", "Part-time", "Work and study (dual)"];

export function joinModes(modes: Set<string>): string | null {
  const list = MODE_ORDER.filter((m) => modes.has(m));
  if (list.length === 0) return null;
  if (list.length === 2 && list[0] === "Full-time" && list[1] === "Part-time") return "Full-time or part-time";
  return list.length === 1 ? list[0] : `${list.slice(0, -1).join(", ")} or ${list.at(-1)!.toLowerCase()}`;
}

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

export interface RegisterLoadResult {
  rows: number;
  programmes: number;
  institutionsMatched: number;
  unmatched: Array<{ name: string; code: string | null; programmes: number }>;
  rorLookups: number;
  /** Institutions added from ROR because the register lists them. */
  institutionsAdded: string[];
  created: number;
  merged: number;
  failedFiles: number;
}

export async function loadRegister(
  prisma: PrismaClient,
  source: RegisterSource,
  programmes: RegisterProgramme[],
  opts: { dryRun?: boolean; useRor?: boolean; addInstitutions?: boolean } = {},
): Promise<RegisterLoadResult> {
  const resolver = new InstitutionResolver(await institutionIndex(prisma), {
    useRor: opts.useRor ?? true,
    // Never in a dry run: adding an institution writes to the database.
    addMissing: opts.addInstitutions && !opts.dryRun ? (rorId) => addFromRor(prisma, rorId) : undefined,
  });
  const byUniversity = new Map<string, Map<string, { p: RegisterProgramme; modes: Set<string> }>>();
  const unmatched = new Map<string, { name: string; code: string | null; programmes: number }>();

  for (const p of programmes) {
    const universityId = await resolver.resolve(p.institution);
    if (!universityId) {
      const key = `${p.institution.code ?? ""}|${p.institution.name}`;
      const u = unmatched.get(key) ?? { name: p.institution.name, code: p.institution.code ?? null, programmes: 0 };
      u.programmes += 1;
      unmatched.set(key, u);
      continue;
    }
    const programmesHere = byUniversity.get(universityId) ?? new Map();
    const existing = programmesHere.get(p.code);
    if (existing) {
      if (p.studyMode) existing.modes.add(p.studyMode);
      existing.p.durationMonths ??= p.durationMonths;
    } else {
      programmesHere.set(p.code, { p: { ...p }, modes: new Set(p.studyMode ? [p.studyMode] : []) });
    }
    byUniversity.set(universityId, programmesHere);
  }

  const result: RegisterLoadResult = {
    rows: programmes.length,
    programmes: [...byUniversity.values()].reduce((n, m) => n + m.size, 0),
    institutionsMatched: byUniversity.size,
    unmatched: [...unmatched.values()].sort((a, b) => b.programmes - a.programmes),
    rorLookups: resolver.rorLookups,
    institutionsAdded: resolver.added,
    created: 0,
    merged: 0,
    failedFiles: 0,
  };
  if (opts.dryRun) return result;

  const dir = path.join(process.cwd(), "data", "extracted", source.sourceId);
  await mkdir(dir, { recursive: true });
  for (const [universityId, entries] of byUniversity) {
    const uni = resolver.nameOf(universityId);
    const extraction: ExtractionFile = {
      sourceId: source.sourceId,
      sourceDocumentId: `${source.sourceId}:${slug(uni.name)}`,
      extractedBy: "manual",
      extractedAt: new Date().toISOString(),
      universities: [],
      programs: [...entries.values()].map(({ p, modes }) => ({
        universityName: uni.name,
        universityWebsite: uni.website,
        name: p.name,
        degreeLevel: p.degreeLevel,
        fieldOfStudy: p.fieldOfStudy,
        fieldCategory: (inferFieldCategory(`${p.fieldOfStudy} ${p.name}`) ?? "OTHER") as never,
        durationMonths: p.durationMonths ?? null,
        instructionLanguages: p.instructionLanguages ?? [],
        tuitionType: p.tuition ? "PAID" : "UNKNOWN",
        tuitionAmount: p.tuition?.amount ?? null,
        tuitionCurrency: p.tuition?.currency ?? null,
        tuitionPeriod: p.tuition?.period ?? null,
        intakes: [],
        studyMode: joinModes(modes),
        // Registers give no programme page; the institution's site is where it is listed.
        programUrl: uni.website,
        description: [p.facts, p.originalName ? `Registered as: ${p.originalName}` : null].filter(Boolean).join(". ") + ".",
        sourceUrl: source.datasetUrl,
        sourceQuote: `${p.originalName ?? p.name} (${p.code})`,
        requirements: [],
        deadlines: [],
      })),
      scholarships: [],
    };
    const file = path.join(dir, `${source.sourceId}_${slug(uni.name)}.json`);
    await writeFile(file, `${JSON.stringify(extraction, null, 2)}\n`);
    try {
      const r = await loadExtractedFile(prisma, file);
      result.created += r.programsCreated;
      result.merged += r.programsMerged;
    } catch {
      result.failedFiles += 1;
    }
  }
  return result;
}
