import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { scoreTarget } from "./scoreTarget";
import { programToMatchTarget, scholarshipToMatchTarget, studentProfileToMatchInput } from "./toMatchTarget";
import { ENGINE_VERSION } from "./weights";
import type { MatchResult } from "./types";
import { isCliEntrypoint } from "../cliEntrypoint";

const MIN_SCORE_TO_STORE = 20;

/**
 * Computes and persists Match rows for one student across every Program and
 * Scholarship. Pre-filters by degree level (a coarse, cheap SQL filter) to
 * keep this tractable as the catalog grows past 1000+ programs — full
 * factor scoring only runs on the pre-filtered set. Only stores matches
 * scoring at or above MIN_SCORE_TO_STORE, to avoid the table filling with
 * near-zero noise.
 *
 * The student's match set is replaced wholesale in one transaction. Updating
 * row by row left behind matches this run no longer produces — a student who
 * switched from Master to PhD kept every Master match, with stale scores —
 * and cost two queries per programme on every profile save.
 */
export async function runMatchForStudent(prisma: PrismaClient, userId: string): Promise<{ programMatches: number; scholarshipMatches: number }> {
  const profileRow = await prisma.studentProfile.findUnique({
    where: { userId },
    include: { languageProficiencies: true },
  });
  if (!profileRow) {
    throw new Error(`No StudentProfile for user ${userId} — cannot compute matches yet.`);
  }
  const profile = studentProfileToMatchInput(profileRow);

  const [programs, scholarships] = await Promise.all([
    prisma.program.findMany({
      where: profile.desiredDegreeLevel ? { degreeLevel: profile.desiredDegreeLevel } : undefined,
      include: { requirements: true, university: true },
    }),
    prisma.scholarship.findMany({ include: { eligibility: true } }),
  ]);

  const computedAt = new Date();
  const toRow = (result: MatchResult) => ({
    userId,
    score: result.score,
    matchStrength: result.matchStrength,
    factorScores: result.factorScores as unknown as object,
    strengths: result.strengths,
    missingRequirements: result.missingRequirements,
    warnings: result.warnings,
    recommendedActions: result.recommendedActions,
    computedAt,
    engineVersion: ENGINE_VERSION,
  });

  const programRows = programs.flatMap((program) => {
    const result = scoreTarget(profile, programToMatchTarget(program), program.verificationStatus === "VERIFIED");
    return result.score < MIN_SCORE_TO_STORE
      ? []
      : [{ ...toRow(result), matchType: "PROGRAM" as const, programId: program.id }];
  });

  const scholarshipRows = scholarships.flatMap((scholarship) => {
    const result = scoreTarget(
      profile,
      scholarshipToMatchTarget(scholarship),
      scholarship.verificationStatus === "VERIFIED",
    );
    return result.score < MIN_SCORE_TO_STORE
      ? []
      : [{ ...toRow(result), matchType: "SCHOLARSHIP" as const, scholarshipId: scholarship.id }];
  });

  await prisma.$transaction([
    prisma.match.deleteMany({ where: { userId } }),
    prisma.match.createMany({ data: [...programRows, ...scholarshipRows] }),
  ]);

  return { programMatches: programRows.length, scholarshipMatches: scholarshipRows.length };
}

async function runAsCli() {
  const userId = process.argv[2];
  if (!userId) {
    console.error("Usage: tsx lib/matching/runMatchForStudent.ts <userId>");
    process.exit(1);
  }
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });
  try {
    console.log(await runMatchForStudent(prisma, userId));
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
