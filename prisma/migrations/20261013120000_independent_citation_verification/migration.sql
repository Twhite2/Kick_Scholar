-- Verification only counts independent sources, and citations stop
-- accumulating on every pipeline run.
--
-- Four changes, in dependency order:
--   1. Remove the citations the loader fabricated from a URL match: when a
--      discovery post linked to an official page on a registered source's
--      domain, the loader recorded that source as corroborating — though
--      nothing from that page had been read.
--   2. Collapse duplicate citations. Every reload appended another row for
--      the same (record, source); keep the earliest.
--   3. Revoke "system:cross-reference" verification from non-PRIMARY records
--      that no longer have an independent PRIMARY/SECONDARY citation, i.e.
--      ones verified only by steps 1–2 or by citing themselves. Admin
--      decisions and PRIMARY-at-insert verification are left untouched.
--   4. Enforce one citation per (record, source) from here on.

-- 1 -------------------------------------------------------------------------
DELETE FROM "SourceCitation" c
USING "Scholarship" sch, "Source" own
WHERE c."sourceableType" = 'SCHOLARSHIP'
  AND c."sourceableId" = sch.id
  AND own.id = sch."primarySourceId"
  AND own."authorityLevel" = 'DISCOVERY'
  AND c."sourceId" <> sch."primarySourceId"
  AND c.role = 'CORROBORATING'
  AND c."officialSourceUrl" IS NOT NULL
  AND c."discoveredFrom" IS NULL
  AND c."sourceDocumentId" IS NULL;

-- 2 -------------------------------------------------------------------------
DELETE FROM "SourceCitation"
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY "sourceableType", "sourceableId", "sourceId"
      ORDER BY "capturedAt" ASC, id ASC
    ) AS rn
    FROM "SourceCitation"
  ) ranked
  WHERE ranked.rn > 1
);

-- 3 -------------------------------------------------------------------------
UPDATE "Scholarship" r
SET verified = false, "verificationStatus" = 'UNVERIFIED', "lastVerifiedAt" = NULL, "verifiedBy" = NULL
WHERE r."verifiedBy" = 'system:cross-reference'
  AND r."authorityLevel" <> 'PRIMARY'
  AND NOT EXISTS (
    SELECT 1 FROM "SourceCitation" c JOIN "Source" s ON s.id = c."sourceId"
    WHERE c."sourceableType" = 'SCHOLARSHIP' AND c."sourceableId" = r.id
      AND c."sourceId" <> r."primarySourceId"
      AND s."authorityLevel" IN ('PRIMARY', 'SECONDARY')
  );

UPDATE "University" r
SET verified = false, "verificationStatus" = 'UNVERIFIED', "lastVerifiedAt" = NULL, "verifiedBy" = NULL
WHERE r."verifiedBy" = 'system:cross-reference'
  AND r."authorityLevel" <> 'PRIMARY'
  AND NOT EXISTS (
    SELECT 1 FROM "SourceCitation" c JOIN "Source" s ON s.id = c."sourceId"
    WHERE c."sourceableType" = 'UNIVERSITY' AND c."sourceableId" = r.id
      AND c."sourceId" <> r."primarySourceId"
      AND s."authorityLevel" IN ('PRIMARY', 'SECONDARY')
  );

UPDATE "Program" r
SET verified = false, "verificationStatus" = 'UNVERIFIED', "lastVerifiedAt" = NULL, "verifiedBy" = NULL
WHERE r."verifiedBy" = 'system:cross-reference'
  AND r."authorityLevel" <> 'PRIMARY'
  AND NOT EXISTS (
    SELECT 1 FROM "SourceCitation" c JOIN "Source" s ON s.id = c."sourceId"
    WHERE c."sourceableType" = 'PROGRAM' AND c."sourceableId" = r.id
      AND c."sourceId" <> r."primarySourceId"
      AND s."authorityLevel" IN ('PRIMARY', 'SECONDARY')
  );

-- 4 -------------------------------------------------------------------------
CREATE UNIQUE INDEX "SourceCitation_sourceableType_sourceableId_sourceId_key"
  ON "SourceCitation"("sourceableType", "sourceableId", "sourceId");
