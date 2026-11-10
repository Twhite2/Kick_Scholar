import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { scoreTarget } from "./scoreTarget";
import { programToMatchTarget, scholarshipToMatchTarget, studentProfileToMatchInput } from "./toMatchTarget";
import { ENGINE_VERSION } from "./weights";
import { isCliEntrypoint } from "../cliEntrypoint";

const MIN_SCORE_TO_STORE = 20;

/**
 * Computes and persists Match rows for one student across every Program and
 * Scholarship. Pre-filters by degree level (a coarse, cheap SQL filter) to
 * keep this tractable as the catalog grows past 1000+ programs — full
 * factor scoring only runs on the pre-filtered set. Only stores matches
 * scoring at or above MIN_SCORE_TO_STORE, to avoid the table filling with
 * near-zero noise.
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

  // Scholarships are scored first so programmes can reuse the verdicts.
  // Judging each scholarship once (151 of them) and counting the results per
  // programme is what keeps this cheap: the alternative re-evaluates the same
  // criteria for every one of the 18,290 links.
  const scholarships = await prisma.scholarship.findMany({ include: { eligibility: true } });
  const scholarshipVerdict = new Map<string, boolean>();
  for (const scholarship of scholarships) {
    const result = scoreTarget(
      profile,
      scholarshipToMatchTarget(scholarship),
      scholarship.verificationStatus === "VERIFIED",
    );
    // "Eligible" means nothing the scholarship states rules the student out.
    // A criterion the profile cannot answer is not counted as a failure —
    // it is unknown, and treating unknown as disqualifying would understate
    // every incomplete profile.
    const eligible = !result.factorScores.some((f) => f.hardFail);
    scholarshipVerdict.set(scholarship.id, eligible);
  }

  // Which scholarships reach each programme, counting both the links made to
  // the programme itself and those made to its university as a whole.
  const links = await prisma.fundingOpportunity.findMany({
    select: { scholarshipId: true, programId: true, universityId: true },
  });
  const byProgram = new Map<string, Set<string>>();
  const byUniversity = new Map<string, Set<string>>();
  for (const link of links) {
    if (link.programId) {
      const set = byProgram.get(link.programId) ?? new Set<string>();
      set.add(link.scholarshipId);
      byProgram.set(link.programId, set);
    } else if (link.universityId) {
      const set = byUniversity.get(link.universityId) ?? new Set<string>();
      set.add(link.scholarshipId);
      byUniversity.set(link.universityId, set);
    }
  }

  const programs = await prisma.program.findMany({
    where: profile.desiredDegreeLevel ? { degreeLevel: profile.desiredDegreeLevel } : undefined,
    include: { requirements: true, university: true },
  });

  let programMatches = 0;
  for (const program of programs) {
    const reachable = new Set<string>([
      ...(byProgram.get(program.id) ?? []),
      ...(byUniversity.get(program.universityId) ?? []),
    ]);
    let eligible = 0;
    for (const id of reachable) if (scholarshipVerdict.get(id)) eligible += 1;

    const target = programToMatchTarget(program, { total: reachable.size, eligible });
    const result = scoreTarget(profile, target, program.verificationStatus === "VERIFIED");
    if (result.score < MIN_SCORE_TO_STORE) continue;

    // Match's (userId, programId) / (userId, scholarshipId) uniqueness is
    // enforced by hand-authored partial unique indexes (see the
    // add_check_constraints_and_partial_indexes migration) rather than a
    // native Prisma @@unique, since Postgres partial indexes aren't
    // expressible in the schema DSL — so this is findFirst+create/update
    // rather than a single upsert() with a named compound-unique selector.
    const existing = await prisma.match.findFirst({ where: { userId, programId: program.id } });
    const data = {
      score: result.score,
      matchStrength: result.matchStrength,
      factorScores: result.factorScores as unknown as object,
      strengths: result.strengths,
      missingRequirements: result.missingRequirements,
      warnings: result.warnings,
      recommendedActions: result.recommendedActions,
      computedAt: new Date(),
      engineVersion: ENGINE_VERSION,
    };
    if (existing) {
      await prisma.match.update({ where: { id: existing.id }, data });
    } else {
      await prisma.match.create({
        data: { userId, matchType: "PROGRAM", programId: program.id, ...data },
      });
    }
    programMatches += 1;
  }

  let scholarshipMatches = 0;
  for (const scholarship of scholarships) {
    const target = scholarshipToMatchTarget(scholarship);
    const result = scoreTarget(profile, target, scholarship.verificationStatus === "VERIFIED");
    if (result.score < MIN_SCORE_TO_STORE) continue;

    const existing = await prisma.match.findFirst({ where: { userId, scholarshipId: scholarship.id } });
    const data = {
      score: result.score,
      matchStrength: result.matchStrength,
      factorScores: result.factorScores as unknown as object,
      strengths: result.strengths,
      missingRequirements: result.missingRequirements,
      warnings: result.warnings,
      recommendedActions: result.recommendedActions,
      computedAt: new Date(),
      engineVersion: ENGINE_VERSION,
    };
    if (existing) {
      await prisma.match.update({ where: { id: existing.id }, data });
    } else {
      await prisma.match.create({
        data: { userId, matchType: "SCHOLARSHIP", scholarshipId: scholarship.id, ...data },
      });
    }
    scholarshipMatches += 1;
  }

  return { programMatches, scholarshipMatches };
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
