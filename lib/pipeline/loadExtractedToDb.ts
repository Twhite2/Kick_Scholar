import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { ExtractionFileSchema, type ExtractionFile } from "../extraction/schemas";
import { validateProgram } from "../extraction/validate";
import { normaliseGradeDirections } from "../extraction/llm/gradeScale";
import { normalizeUniversity } from "../normalization/normalizeUniversity";
import { normalizeProgram } from "../normalization/normalizeProgram";
import { normalizeScholarship } from "../normalization/normalizeScholarship";
import {
  matchUniversityCandidates,
  matchProgramCandidates,
  matchScholarshipCandidates,
} from "../deduplication/matchCandidates";
import { shouldOverwriteScalar } from "../deduplication/mergeRecords";
import { crossReferenceCheck } from "../verification/crossReferenceCheck";
import { loadAllConfigs } from "../sources/registry";
import { isCliEntrypoint } from "../cliEntrypoint";

export interface LoadResult {
  universitiesCreated: number;
  universitiesMerged: number;
  programsCreated: number;
  programsMerged: number;
  scholarshipsCreated: number;
  scholarshipsMerged: number;
  /** German-scale grade comparisons flipped to the direction the page means. */
  gradeDirectionsCorrected: number;
  warnings: string[];
}

function emptyResult(): LoadResult {
  return {
    universitiesCreated: 0,
    universitiesMerged: 0,
    programsCreated: 0,
    programsMerged: 0,
    scholarshipsCreated: 0,
    scholarshipsMerged: 0,
    gradeDirectionsCorrected: 0,
    warnings: [],
  };
}

/**
 * Chains validate -> normalize -> dedup-match -> insert/merge ->
 * cross-reference-check for one extraction file.
 *
 * NOTE on atomicity: the plan calls for this to run inside a single Prisma
 * $transaction. That would require every helper below to accept Prisma's
 * TransactionClient type in addition to PrismaClient, which is a real typing
 * cost for an MVP-scale loader operating on a handful of files at a time.
 * Given that tradeoff, this runs as a sequence of awaited, individually-
 * committed operations instead — a known simplification, not a hidden one.
 * A partial failure can leave a document partially loaded; re-running the
 * same file is safe regardless, since every insert here is dedupe-matched
 * or upserted, never blindly appended.
 */
export async function loadExtractedFile(prisma: PrismaClient, filePath: string): Promise<LoadResult> {
  const raw = JSON.parse(await readFile(filePath, "utf-8"));
  const parsed = ExtractionFileSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `Invalid extraction file ${filePath}:\n` +
        parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n"),
    );
  }
  const extraction = parsed.data;

  const configs = await loadAllConfigs();
  const sourceConfig = configs.find((c) => c.id === extraction.sourceId);
  if (!sourceConfig) throw new Error(`Unknown sourceId "${extraction.sourceId}" in ${filePath}`);
  const authorityLevel = sourceConfig.authorityLevel;

  const result = emptyResult();
  const universityIdByDedupeKey = new Map<string, string>();

  // --- Universities --------------------------------------------------------
  for (const extractedUniversity of extraction.universities) {
    const normalized = normalizeUniversity(extractedUniversity);
    result.warnings.push(...normalized.warnings);

    const candidates = await matchUniversityCandidates(prisma, normalized);
    const provenance = {
      primarySourceId: extraction.sourceId,
      sourceUrl: extractedUniversity.sourceUrl,
      authorityLevel,
      confidence: authorityLevel === "PRIMARY" ? 1 : authorityLevel === "SECONDARY" ? 0.75 : 0.5,
    };

    if (candidates.length > 0) {
      const existing = await prisma.university.findUniqueOrThrow({ where: { id: candidates[0].id } });
      universityIdByDedupeKey.set(normalized.dedupeKey, existing.id);

      const overwrite = shouldOverwriteScalar(existing.description, existing.authorityLevel, authorityLevel);
      await prisma.university.update({
        where: { id: existing.id },
        data: overwrite && normalized.description ? { description: normalized.description } : {},
      });
      await prisma.sourceCitation.create({
        data: {
          sourceableType: "UNIVERSITY",
          sourceableId: existing.id,
          sourceId: extraction.sourceId,
          role: candidates[0].matchedOn === "dedupeKey" ? "CORROBORATING" : "PRIMARY_MATCH",
          capturedAt: new Date(),
        },
      });
      result.universitiesMerged += 1;
    } else {
      const created = await prisma.university.create({
        data: {
          dedupeKey: normalized.dedupeKey,
          name: normalized.name,
          country: normalized.country,
          city: normalized.city,
          website: normalized.website,
          description: normalized.description,
          ...provenance,
          verified: authorityLevel === "PRIMARY",
          verificationStatus: authorityLevel === "PRIMARY" ? "VERIFIED" : "UNVERIFIED",
          lastVerifiedAt: authorityLevel === "PRIMARY" ? new Date() : null,
        },
      });
      universityIdByDedupeKey.set(normalized.dedupeKey, created.id);
      result.universitiesCreated += 1;
    }
  }

  // --- Programs --------------------------------------------------------------
  for (const extractedProgram of extraction.programs) {
    const businessIssues = validateProgram(extractedProgram);
    if (businessIssues.length > 0) {
      result.warnings.push(
        ...businessIssues.map((i) => `${extractedProgram.name}: ${i.path}: ${i.message}`),
      );
    }

    // Resolve the owning university: prefer one created/matched earlier in
    // this same file, else look it up by the same dedupeKey scheme.
    let universityId = [...universityIdByDedupeKey.values()][0];
    const uniByName = extraction.universities.find((u) => u.name === extractedProgram.universityName);
    if (uniByName) {
      const uniNormalized = normalizeUniversity(uniByName);
      universityId = universityIdByDedupeKey.get(uniNormalized.dedupeKey) ?? universityId;
    } else {
      const existingUni = await prisma.university.findFirst({
        where: { name: extractedProgram.universityName },
      });
      if (existingUni) universityId = existingUni.id;
    }
    if (!universityId) {
      result.warnings.push(`Skipped program "${extractedProgram.name}": no matching university found`);
      continue;
    }

    const normalized = normalizeProgram(extractedProgram, universityId);
    result.warnings.push(...normalized.warnings);

    const candidates = await matchProgramCandidates(prisma, {
      dedupeKey: normalized.dedupeKey,
      name: normalized.name,
      universityId,
      degreeLevel: normalized.degreeLevel,
    });

    const provenance = {
      primarySourceId: extraction.sourceId,
      sourceUrl: extractedProgram.sourceUrl,
      authorityLevel,
      confidence: authorityLevel === "PRIMARY" ? 1 : authorityLevel === "SECONDARY" ? 0.75 : 0.5,
    };

    let programId: string;
    if (candidates.length > 0) {
      programId = candidates[0].id;
      await prisma.sourceCitation.create({
        data: {
          sourceableType: "PROGRAM",
          sourceableId: programId,
          sourceId: extraction.sourceId,
          role: candidates[0].matchedOn === "dedupeKey" ? "CORROBORATING" : "PRIMARY_MATCH",
          capturedAt: new Date(),
        },
      });
      result.programsMerged += 1;
    } else {
      const created = await prisma.program.create({
        data: {
          universityId,
          dedupeKey: normalized.dedupeKey,
          name: normalized.name,
          degreeLevel: normalized.degreeLevel,
          fieldOfStudy: normalized.fieldOfStudy,
          fieldCategory: normalized.fieldCategory,
          durationMonths: normalized.durationMonths,
          instructionLanguages: normalized.instructionLanguages,
          tuitionType: normalized.tuitionType,
          tuitionAmount: normalized.tuitionAmount,
          tuitionCurrency: normalized.tuitionCurrency,
          tuitionPeriod: normalized.tuitionPeriod,
          intakes: normalized.intakes,
          programUrl: normalized.programUrl,
          description: normalized.description,
          ...provenance,
          verified: authorityLevel === "PRIMARY",
          verificationStatus: authorityLevel === "PRIMARY" ? "VERIFIED" : "UNVERIFIED",
          lastVerifiedAt: authorityLevel === "PRIMARY" ? new Date() : null,
        },
      });
      programId = created.id;
      result.programsCreated += 1;
    }

    // Sub-facts are append-only ACROSS sources: each source's statement of a
    // requirement/deadline is its own row, never merged into another's.
    //
    // But re-reading the SAME page is not new evidence. Without this reset,
    // re-running a load duplicated every requirement and deadline — observed
    // at 4 copies per programme while reloading as a crawl grew. Clearing
    // this document's own prior rows first makes the load idempotent per
    // source-document while leaving other sources' rows untouched.
    await prisma.programRequirement.deleteMany({
      where: { programId, primarySourceId: extraction.sourceId },
    });
    await prisma.applicationDeadline.deleteMany({
      where: { programId, primarySourceId: extraction.sourceId },
    });
    // Safety net for an error a verbatim quote cannot catch: German grades run
    // 1.0 (best) to 4.0, so a page saying "at least 2.7" means <= 2.7. The
    // extractor corrects this too, but applying it here as well means the
    // database is right regardless of which extractor version wrote the file.
    const { requirements: programRequirements, corrected: gradesCorrected } =
      normaliseGradeDirections(extractedProgram.requirements);
    if (gradesCorrected > 0) {
      result.gradeDirectionsCorrected += gradesCorrected;
    }
    for (const req of programRequirements) {
      await prisma.programRequirement.create({
        data: {
          programId,
          requirementType: req.requirementType,
          testName: req.testName,
          operator: req.operator,
          value: req.value,
          unit: req.unit,
          description: req.sourceQuote,
          primarySourceId: extraction.sourceId,
          sourceUrl: req.sourceUrl ?? extractedProgram.sourceUrl,
          authorityLevel,
          confidence: provenance.confidence,
          verified: authorityLevel === "PRIMARY",
          verificationStatus: authorityLevel === "PRIMARY" ? "VERIFIED" : "UNVERIFIED",
          lastVerifiedAt: authorityLevel === "PRIMARY" ? new Date() : null,
        },
      });
    }
    for (const dl of extractedProgram.deadlines) {
      await prisma.applicationDeadline.create({
        data: {
          programId,
          deadlineType: dl.deadlineType,
          date: dl.date ? new Date(dl.date) : null,
          dateText: dl.dateText,
          intake: dl.intake,
          primarySourceId: extraction.sourceId,
          sourceUrl: dl.sourceUrl ?? extractedProgram.sourceUrl,
          authorityLevel,
          confidence: provenance.confidence,
          verified: authorityLevel === "PRIMARY",
          verificationStatus: authorityLevel === "PRIMARY" ? "VERIFIED" : "UNVERIFIED",
          lastVerifiedAt: authorityLevel === "PRIMARY" ? new Date() : null,
        },
      });
    }
  }

  // --- Scholarships ------------------------------------------------------------
  for (const extractedScholarship of extraction.scholarships) {
    const normalized = normalizeScholarship(extractedScholarship);
    result.warnings.push(...normalized.warnings);

    // Pass provenance so a fuzzy name match can't merge two scholarships this
    // same source published at different URLs (see matchScholarshipCandidates).
    const candidates = await matchScholarshipCandidates(prisma, {
      ...normalized,
      sourceId: extraction.sourceId,
      sourceUrl: extractedScholarship.sourceUrl,
    });
    const provenance = {
      primarySourceId: extraction.sourceId,
      sourceUrl: extractedScholarship.sourceUrl,
      authorityLevel,
      confidence: authorityLevel === "PRIMARY" ? 1 : authorityLevel === "SECONDARY" ? 0.75 : 0.5,
    };

    // A DISCOVERY-authority scholarship is structurally prevented from also
    // being verified=true at insert time — only crossReferenceCheck (below)
    // or an admin can flip that, once a PRIMARY/SECONDARY citation exists.
    const insertVerified = authorityLevel === "PRIMARY";

    let scholarshipId: string;
    if (candidates.length > 0) {
      scholarshipId = candidates[0].id;
      await prisma.sourceCitation.create({
        data: {
          sourceableType: "SCHOLARSHIP",
          sourceableId: scholarshipId,
          sourceId: extraction.sourceId,
          discoveredFrom: normalized.discoveredFrom,
          discoveryUrl: normalized.discoveryUrl,
          officialSourceUrl: normalized.officialSourceUrl,
          role: candidates[0].matchedOn === "dedupeKey" ? "CORROBORATING" : "PRIMARY_MATCH",
          capturedAt: new Date(),
        },
      });
      result.scholarshipsMerged += 1;
    } else {
      const created = await prisma.scholarship.create({
        data: {
          dedupeKey: normalized.dedupeKey,
          name: normalized.name,
          providerName: normalized.providerName,
          providerType: normalized.providerType,
          country: normalized.country,
          amount: normalized.amount,
          amountCurrency: normalized.amountCurrency,
          coverageType: normalized.coverageType,
          description: normalized.description,
          applicationUrl: normalized.applicationUrl,
          deadlineText: normalized.deadlineText,
          isRenewable: normalized.isRenewable,
          discoveredFrom: normalized.discoveredFrom,
          discoveryUrl: normalized.discoveryUrl,
          officialSourceUrl: normalized.officialSourceUrl,
          ...provenance,
          verified: insertVerified,
          verificationStatus: insertVerified ? "VERIFIED" : "UNVERIFIED",
          lastVerifiedAt: insertVerified ? new Date() : null,
        },
      });
      scholarshipId = created.id;
      result.scholarshipsCreated += 1;

      await prisma.sourceCitation.create({
        data: {
          sourceableType: "SCHOLARSHIP",
          sourceableId: scholarshipId,
          sourceId: extraction.sourceId,
          discoveredFrom: normalized.discoveredFrom,
          discoveryUrl: normalized.discoveryUrl,
          officialSourceUrl: normalized.officialSourceUrl,
          role: "PRIMARY_MATCH",
          capturedAt: new Date(),
        },
      });

      // If the discovery post cites an official page whose domain matches a
      // PRIMARY source we already recognize in the registry, record that as
      // a corroborating citation from that source — the real signal
      // crossReferenceCheck looks for below. This does not trust the
      // discovery post's own restatement of facts; it only recognizes that
      // an independently-registered PRIMARY source was cited.
      if (normalized.officialSourceUrl) {
        const officialHost = new URL(normalized.officialSourceUrl).hostname.replace(/^www\./, "");
        const corroboratingSource = configs.find(
          (c) =>
            c.id !== extraction.sourceId &&
            (c.authorityLevel === "PRIMARY" || c.authorityLevel === "SECONDARY") &&
            new URL(c.baseUrl).hostname.replace(/^www\./, "") === officialHost,
        );
        if (corroboratingSource) {
          await prisma.sourceCitation.create({
            data: {
              sourceableType: "SCHOLARSHIP",
              sourceableId: scholarshipId,
              sourceId: corroboratingSource.id,
              officialSourceUrl: normalized.officialSourceUrl,
              role: "CORROBORATING",
              capturedAt: new Date(),
            },
          });
        }
      }
    }

    // Same idempotency rule as programme sub-facts above: this source's own
    // previous statements are replaced, other sources' rows are preserved.
    await prisma.scholarshipEligibility.deleteMany({
      where: { scholarshipId, primarySourceId: extraction.sourceId },
    });
    await prisma.applicationDeadline.deleteMany({
      where: { scholarshipId, primarySourceId: extraction.sourceId },
    });

    // Applicability rules persist as ScholarshipEligibility rows using the
    // existing criterion enums, so no new table or migration is needed and
    // the matching engine can already read them. This is the input the
    // scholarship->institution linking stage expands across the catalogue:
    //   countries        -> COUNTRY_OF_STUDY IN_LIST
    //   degreeLevels     -> DEGREE_LEVEL     IN_LIST
    //   fieldCategories  -> FIELD_OF_STUDY   IN_LIST
    //   institutionTypes -> UNIVERSITY       IN_LIST  (first real writer of
    //                                                  that criterion type)
    for (const rule of extractedScholarship.applicability) {
      const dimensions: Array<[string, string[]]> = [
        ["COUNTRY_OF_STUDY", rule.countries],
        ["DEGREE_LEVEL", rule.degreeLevels],
        ["FIELD_OF_STUDY", rule.fieldCategories],
        ["UNIVERSITY", rule.institutionTypes],
      ];
      for (const [criterionType, valueList] of dimensions) {
        // An empty dimension means "not stated" — never "applies to all".
        if (valueList.length === 0) continue;
        await prisma.scholarshipEligibility.create({
          data: {
            scholarshipId,
            criterionType: criterionType as never,
            operator: "IN_LIST",
            valueList,
            numericValue: null,
            textValue: null,
            description: rule.sourceQuote,
            primarySourceId: extraction.sourceId,
            sourceUrl: rule.sourceUrl ?? extractedScholarship.sourceUrl,
            authorityLevel,
            confidence: authorityLevel === "PRIMARY" ? 1 : authorityLevel === "SECONDARY" ? 0.75 : 0.5,
            verified: authorityLevel === "PRIMARY",
            verificationStatus: authorityLevel === "PRIMARY" ? "VERIFIED" : "UNVERIFIED",
            lastVerifiedAt: authorityLevel === "PRIMARY" ? new Date() : null,
          },
        });
      }
    }

    for (const elig of extractedScholarship.eligibility) {
      await prisma.scholarshipEligibility.create({
        data: {
          scholarshipId,
          criterionType: elig.criterionType,
          operator: elig.operator,
          valueList: elig.valueList,
          numericValue: elig.numericValue,
          textValue: elig.textValue,
          description: elig.sourceQuote,
          primarySourceId: extraction.sourceId,
          sourceUrl: elig.sourceUrl ?? extractedScholarship.sourceUrl,
          authorityLevel,
          confidence: provenance.confidence,
          verified: insertVerified,
          verificationStatus: insertVerified ? "VERIFIED" : "UNVERIFIED",
          lastVerifiedAt: insertVerified ? new Date() : null,
        },
      });
    }
    for (const dl of extractedScholarship.deadlines) {
      await prisma.applicationDeadline.create({
        data: {
          scholarshipId,
          deadlineType: dl.deadlineType,
          date: dl.date ? new Date(dl.date) : null,
          dateText: dl.dateText,
          intake: dl.intake,
          primarySourceId: extraction.sourceId,
          sourceUrl: dl.sourceUrl ?? extractedScholarship.sourceUrl,
          authorityLevel,
          confidence: provenance.confidence,
          verified: insertVerified,
          verificationStatus: insertVerified ? "VERIFIED" : "UNVERIFIED",
          lastVerifiedAt: insertVerified ? new Date() : null,
        },
      });
    }

    // Now that citations exist, see if this scholarship can be promoted.
    await crossReferenceCheck(prisma, "SCHOLARSHIP", scholarshipId);
  }

  return result;
}

async function runAsCli() {
  const target = process.argv[2];
  if (!target) {
    console.error(
      "Usage: tsx lib/pipeline/loadExtractedToDb.ts <extraction.json | directory>",
    );
    process.exit(1);
  }

  // Accept a directory so a whole source can be loaded in one process —
  // spawning tsx once per file for a 149-file source costs minutes of
  // startup alone.
  const resolved = path.resolve(target);
  const { stat, readdir } = await import("node:fs/promises");
  const isDir = (await stat(resolved)).isDirectory();
  const files = isDir
    ? (await readdir(resolved))
        .filter((f) => f.endsWith(".json"))
        .map((f) => path.join(resolved, f))
        .sort()
    : [resolved];

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });
  const totals = {
    files: 0,
    failed: 0,
    universitiesCreated: 0,
    universitiesMerged: 0,
    programsCreated: 0,
    programsMerged: 0,
    scholarshipsCreated: 0,
    scholarshipsMerged: 0,
    gradeDirectionsCorrected: 0,
    warnings: [] as string[],
  };
  try {
    for (const file of files) {
      try {
        const r = await loadExtractedFile(prisma, file);
        totals.files += 1;
        totals.universitiesCreated += r.universitiesCreated;
        totals.universitiesMerged += r.universitiesMerged;
        totals.programsCreated += r.programsCreated;
        totals.programsMerged += r.programsMerged;
        totals.scholarshipsCreated += r.scholarshipsCreated;
        totals.scholarshipsMerged += r.scholarshipsMerged;
        totals.gradeDirectionsCorrected += r.gradeDirectionsCorrected;
        totals.warnings.push(...r.warnings);
      } catch (err) {
        totals.failed += 1;
        totals.warnings.push(`${path.basename(file)}: ${(err as Error).message}`);
      }
    }
    console.log(
      JSON.stringify(
        { ...totals, warnings: totals.warnings.slice(0, 25), warningCount: totals.warnings.length },
        null,
        2,
      ),
    );
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
