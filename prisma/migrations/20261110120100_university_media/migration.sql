-- Logos and cover photos for institutions, cached on our own storage by
-- scripts/enrich-institution-media.ts. Credit and licence travel with the
-- cover because Wikimedia Commons images require attribution.
ALTER TABLE "University"
  ADD COLUMN "logoSource" TEXT,
  ADD COLUMN "logoCheckedAt" TIMESTAMP(3),
  ADD COLUMN "coverUrl" TEXT,
  ADD COLUMN "coverWidth" INTEGER,
  ADD COLUMN "coverHeight" INTEGER,
  ADD COLUMN "coverColor" TEXT,
  ADD COLUMN "coverCredit" TEXT,
  ADD COLUMN "coverLicense" TEXT,
  ADD COLUMN "coverLicenseUrl" TEXT,
  ADD COLUMN "coverSourceUrl" TEXT,
  ADD COLUMN "coverCheckedAt" TIMESTAMP(3),
  ADD COLUMN "wikidataId" TEXT,
  ADD COLUMN "domain" TEXT,
  ADD COLUMN "acronym" TEXT,
  ADD COLUMN "mediaLocked" BOOLEAN NOT NULL DEFAULT false;
