import type { PrismaClient } from "../generated/prisma/client";

export interface MatchCandidate {
  id: string;
  dedupeKey: string;
  name: string;
  similarity: number; // 1.0 = exact dedupeKey match
  matchedOn: "dedupeKey" | "name-similarity" | "canonical-url";
}

const SIMILARITY_THRESHOLD = 0.6;

/**
 * Ranks existing University rows against a normalized candidate. Exact
 * dedupeKey match short-circuits (score 1.0); otherwise falls back to
 * pg_trgm name similarity, hard-gated to the same country so "University of
 * X" in two different countries never merges on name alone.
 */
export async function matchUniversityCandidates(
  prisma: PrismaClient,
  candidate: {
    dedupeKey: string;
    name: string;
    country: string;
    /**
     * The candidate's ROR id, when it has one. Supplying it blocks fuzzy
     * merges onto universities that already carry a DIFFERENT ROR id.
     *
     * Country-gating alone is not enough. Germany has dozens of institutions
     * whose names differ only at the end ("… University of Applied Sciences
     * Biberach" / "… Wildau" / "… Landshut"), so pg_trgm scores them well
     * above 0.6 and merges them. Importing 1,248 ROR-vetted institutions
     * produced just 792 universities — 456 lost, with one row absorbing 38
     * separate institutions. ROR ids are authoritative unique identity: two
     * different ids are two different organisations, whatever the names look
     * like. A university with no ROR id yet is still fair game to merge onto,
     * which is what lets ROR enrich an already-crawled university.
     */
    rorId?: string | null;
  },
): Promise<MatchCandidate[]> {
  const exact = await prisma.university.findUnique({ where: { dedupeKey: candidate.dedupeKey } });
  if (exact) {
    return [{ id: exact.id, dedupeKey: exact.dedupeKey, name: exact.name, similarity: 1, matchedOn: "dedupeKey" }];
  }

  const candidateRorId = candidate.rorId ?? null;

  const fuzzy = await prisma.$queryRaw<Array<{ id: string; dedupeKey: string; name: string; similarity: number }>>`
    SELECT id, "dedupeKey", name, similarity(name, ${candidate.name}) AS similarity
    FROM "University"
    WHERE country = ${candidate.country}
      AND similarity(name, ${candidate.name}) > ${SIMILARITY_THRESHOLD}
      AND (
        ${candidateRorId}::text IS NULL
        OR "rorId" IS NULL
        OR "rorId" = ${candidateRorId}::text
      )
    ORDER BY similarity DESC
    LIMIT 5
  `;
  return fuzzy.map((f) => ({ ...f, matchedOn: "name-similarity" as const }));
}

/** Same shape for Program, gated to the same university + degree level. */
export async function matchProgramCandidates(
  prisma: PrismaClient,
  candidate: { dedupeKey: string; name: string; universityId: string; degreeLevel: string },
): Promise<MatchCandidate[]> {
  const exact = await prisma.program.findUnique({ where: { dedupeKey: candidate.dedupeKey } });
  if (exact) {
    return [{ id: exact.id, dedupeKey: exact.dedupeKey, name: exact.name, similarity: 1, matchedOn: "dedupeKey" }];
  }

  const fuzzy = await prisma.$queryRaw<Array<{ id: string; dedupeKey: string; name: string; similarity: number }>>`
    SELECT id, "dedupeKey", name, similarity(name, ${candidate.name}) AS similarity
    FROM "Program"
    WHERE "universityId" = ${candidate.universityId}
      AND "degreeLevel" = ${candidate.degreeLevel}::"DegreeLevel"
      AND similarity(name, ${candidate.name}) > ${SIMILARITY_THRESHOLD}
    ORDER BY similarity DESC
    LIMIT 5
  `;
  return fuzzy.map((f) => ({ ...f, matchedOn: "name-similarity" as const }));
}

/**
 * Same shape for Scholarship. Not gated by country (scholarships can be
 * global), but gated by *provenance*: a fuzzy name match never merges two
 * records that the SAME source published at DIFFERENT URLs.
 *
 * Why: fuzzy matching exists to reconcile the same scholarship described by
 * different sources. When one source publishes two separate detail pages, it
 * is asserting they are two different scholarships, and it is authoritative
 * about its own catalogue — so name similarity must not overrule it.
 *
 * This is not hypothetical. DAAD lists KOSPIE separately for Tunisia, Mexico,
 * Colombia and India; the names share a ~90-character prefix ("Combined study
 * and practice stays for engineers from developing countries (KOSPIE) with
 * …"), so pg_trgm scored them well above the 0.6 threshold and collapsed all
 * four into one row. Loading the 149-page DAAD corpus silently produced 122
 * scholarships — 27 distinct programmes lost. Cross-source reconciliation
 * (e.g. a Bright Scholarship post matching an ARES record) is unaffected,
 * because those carry a different primarySourceId.
 */
export async function matchScholarshipCandidates(
  prisma: PrismaClient,
  candidate: {
    dedupeKey: string;
    name: string;
    /** Source publishing this record; omit to disable the guard. */
    sourceId?: string;
    /** The record's own page URL within that source. */
    sourceUrl?: string;
  },
): Promise<MatchCandidate[]> {
  const exact = await prisma.scholarship.findUnique({ where: { dedupeKey: candidate.dedupeKey } });
  if (exact) {
    return [{ id: exact.id, dedupeKey: exact.dedupeKey, name: exact.name, similarity: 1, matchedOn: "dedupeKey" }];
  }

  const guardSourceId = candidate.sourceId ?? null;
  const guardSourceUrl = candidate.sourceUrl ?? null;

  const fuzzy = await prisma.$queryRaw<Array<{ id: string; dedupeKey: string; name: string; similarity: number }>>`
    SELECT id, "dedupeKey", name, similarity(name, ${candidate.name}) AS similarity
    FROM "Scholarship"
    WHERE similarity(name, ${candidate.name}) > ${SIMILARITY_THRESHOLD}
      AND NOT (
        ${guardSourceId}::text IS NOT NULL
        AND "primarySourceId" = ${guardSourceId}::text
        AND "sourceUrl" IS DISTINCT FROM ${guardSourceUrl}::text
      )
    ORDER BY similarity DESC
    LIMIT 5
  `;
  return fuzzy.map((f) => ({ ...f, matchedOn: "name-similarity" as const }));
}
