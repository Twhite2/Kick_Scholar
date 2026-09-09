-- FundingOpportunity becomes a real, re-computable link rather than a
-- hand-seeded one.
--
-- Four changes, in dependency order:
--   1. LinkMethod  — separates "the source said so" from "our rules imply it".
--   2. dedupeKey   — reproducible identity so re-running the linker upserts
--                    instead of accumulating duplicate rows.
--   3. universityId gets a real foreign key. It was a bare String? with no
--      relation, so `include: { university: true }` was impossible and nothing
--      stopped a row pointing at a deleted university.
--   4. inferenceBasis — records which predicates fired, so an inferred link
--      can be explained rather than merely asserted.

-- 1 -------------------------------------------------------------------------
CREATE TYPE "LinkMethod" AS ENUM ('EXPLICIT_SOURCE', 'RULE_INFERENCE');

ALTER TABLE "FundingOpportunity"
  ADD COLUMN "linkMethod" "LinkMethod" NOT NULL DEFAULT 'EXPLICIT_SOURCE',
  ADD COLUMN "inferenceBasis" JSONB,
  ADD COLUMN "dedupeKey" TEXT;

-- 2 -------------------------------------------------------------------------
-- Backfill existing rows with the same key shape the linker computes, so this
-- migration is safe on a populated database and not only on an empty one.
-- COALESCE keeps the key total for university-only and program-only rows.
UPDATE "FundingOpportunity"
SET "dedupeKey" = "scholarshipId"
  || ':u:' || COALESCE("universityId", '-')
  || ':p:' || COALESCE("programId", '-')
WHERE "dedupeKey" IS NULL;

-- Any pre-existing duplicates of that triple are a data error, not something
-- to silently keep: collapse them before the unique index goes on.
DELETE FROM "FundingOpportunity" a
USING "FundingOpportunity" b
WHERE a."dedupeKey" = b."dedupeKey" AND a."id" > b."id";

ALTER TABLE "FundingOpportunity" ALTER COLUMN "dedupeKey" SET NOT NULL;
CREATE UNIQUE INDEX "FundingOpportunity_dedupeKey_key" ON "FundingOpportunity"("dedupeKey");

-- 3 -------------------------------------------------------------------------
-- Drop rows whose universityId points at nothing before adding the FK, so the
-- constraint can actually be created on an existing database.
DELETE FROM "FundingOpportunity" f
WHERE f."universityId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "University" u WHERE u."id" = f."universityId");

ALTER TABLE "FundingOpportunity"
  ADD CONSTRAINT "FundingOpportunity_universityId_fkey"
  FOREIGN KEY ("universityId") REFERENCES "University"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 4 -------------------------------------------------------------------------
CREATE INDEX "FundingOpportunity_scholarshipId_linkMethod_idx"
  ON "FundingOpportunity"("scholarshipId", "linkMethod");
