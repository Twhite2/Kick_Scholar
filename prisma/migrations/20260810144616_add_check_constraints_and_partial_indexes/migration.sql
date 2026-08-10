-- Hand-authored: Prisma's schema DSL has no native XOR/CHECK constraint
-- support, so the "exactly one of programId/scholarshipId" and "at least one
-- of universityId/programId" invariants described in the data model plan are
-- enforced here directly in SQL, on top of the application-layer checks in
-- lib/matching and the various server actions.

-- ApplicationDeadline: linked to exactly one of Program or Scholarship.
ALTER TABLE "ApplicationDeadline"
  ADD CONSTRAINT "ApplicationDeadline_program_xor_scholarship"
  CHECK (num_nonnulls("programId", "scholarshipId") = 1);

-- FundingOpportunity: at least a university or a program must be named.
ALTER TABLE "FundingOpportunity"
  ADD CONSTRAINT "FundingOpportunity_university_or_program"
  CHECK (num_nonnulls("universityId", "programId") >= 1);

-- Match: exactly one of Program or Scholarship, and at most one computed
-- match per (user, program) / (user, scholarship) pair.
ALTER TABLE "Match"
  ADD CONSTRAINT "Match_program_xor_scholarship"
  CHECK (num_nonnulls("programId", "scholarshipId") = 1);

CREATE UNIQUE INDEX "Match_userId_programId_key"
  ON "Match" ("userId", "programId")
  WHERE "programId" IS NOT NULL;

CREATE UNIQUE INDEX "Match_userId_scholarshipId_key"
  ON "Match" ("userId", "scholarshipId")
  WHERE "scholarshipId" IS NOT NULL;

-- SavedOpportunity: same XOR + "save it once" pattern as Match.
ALTER TABLE "SavedOpportunity"
  ADD CONSTRAINT "SavedOpportunity_program_xor_scholarship"
  CHECK (num_nonnulls("programId", "scholarshipId") = 1);

CREATE UNIQUE INDEX "SavedOpportunity_userId_programId_key"
  ON "SavedOpportunity" ("userId", "programId")
  WHERE "programId" IS NOT NULL;

CREATE UNIQUE INDEX "SavedOpportunity_userId_scholarshipId_key"
  ON "SavedOpportunity" ("userId", "scholarshipId")
  WHERE "scholarshipId" IS NOT NULL;

-- Application: exactly one of Program or Scholarship (a student can apply to
-- the same opportunity more than once over time, e.g. after a rejection, so
-- unlike Match/SavedOpportunity this is not additionally made unique).
ALTER TABLE "Application"
  ADD CONSTRAINT "Application_program_xor_scholarship"
  CHECK (num_nonnulls("programId", "scholarshipId") = 1);
