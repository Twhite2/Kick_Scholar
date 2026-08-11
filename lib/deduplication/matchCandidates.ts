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
  candidate: { dedupeKey: string; name: string; country: string },
): Promise<MatchCandidate[]> {
  const exact = await prisma.university.findUnique({ where: { dedupeKey: candidate.dedupeKey } });
  if (exact) {
    return [{ id: exact.id, dedupeKey: exact.dedupeKey, name: exact.name, similarity: 1, matchedOn: "dedupeKey" }];
  }

  const fuzzy = await prisma.$queryRaw<Array<{ id: string; dedupeKey: string; name: string; similarity: number }>>`
    SELECT id, "dedupeKey", name, similarity(name, ${candidate.name}) AS similarity
    FROM "University"
    WHERE country = ${candidate.country}
      AND similarity(name, ${candidate.name}) > ${SIMILARITY_THRESHOLD}
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

/** Same shape for Scholarship, gated to nothing (scholarships can be global). */
export async function matchScholarshipCandidates(
  prisma: PrismaClient,
  candidate: { dedupeKey: string; name: string },
): Promise<MatchCandidate[]> {
  const exact = await prisma.scholarship.findUnique({ where: { dedupeKey: candidate.dedupeKey } });
  if (exact) {
    return [{ id: exact.id, dedupeKey: exact.dedupeKey, name: exact.name, similarity: 1, matchedOn: "dedupeKey" }];
  }

  const fuzzy = await prisma.$queryRaw<Array<{ id: string; dedupeKey: string; name: string; similarity: number }>>`
    SELECT id, "dedupeKey", name, similarity(name, ${candidate.name}) AS similarity
    FROM "Scholarship"
    WHERE similarity(name, ${candidate.name}) > ${SIMILARITY_THRESHOLD}
    ORDER BY similarity DESC
    LIMIT 5
  `;
  return fuzzy.map((f) => ({ ...f, matchedOn: "name-similarity" as const }));
}
