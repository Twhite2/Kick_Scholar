import type { PrismaClient } from "@/lib/generated/prisma/client";
import { deriveRules, isLinkable, type ScholarshipRules } from "./rules";

/**
 * Expands each scholarship's own eligibility rules across the catalogue to
 * work out which universities and programmes it can actually be used for.
 *
 * This is the answer to "which institutions does this scholarship apply to?"
 * for the ordinary case, which is not the case the schema was originally
 * shaped around. A DAAD scholarship page names no university at all — it says
 * "state or state-recognised universities in Germany". There is no institution
 * to extract, only a rule to evaluate. So the link is computed, and every row
 * it writes is marked RULE_INFERENCE and must surface as "may apply to",
 * never as a stated fact.
 *
 * Everything here is bounded by construction: counts happen in SQL, a
 * scholarship that would exceed the cap steps up to a coarser level rather
 * than truncating, and a re-run converges on the same set instead of
 * accumulating.
 */

/**
 * Above this many rows a scholarship is not "linked to 4,000 things", it is
 * unbounded, and the honest representation is its rules rather than a wall of
 * links. Truncating to an arbitrary first N would be worse than either.
 */
export const MAX_LINKS_PER_SCHOLARSHIP = 500;

export type LinkLevel = "PROGRAM" | "UNIVERSITY";

export interface ScholarshipLinkOutcome {
  scholarshipId: string;
  scholarshipName: string;
  rules: ScholarshipRules;
  level: LinkLevel | null;
  linksWritten: number;
  linksDeleted: number;
  /** Why nothing was written, when nothing was. */
  skipped?: "no-usable-rules" | "too-broad" | "no-matches";
  candidateCount?: number;
}

export interface InferenceRunResult {
  scholarshipsConsidered: number;
  scholarshipsLinked: number;
  linksWritten: number;
  linksDeleted: number;
  skippedNoRules: number;
  skippedTooBroad: number;
  skippedNoMatches: number;
  outcomes: ScholarshipLinkOutcome[];
}

/** Reproducible identity for one (scholarship, university, program) triple. */
export function linkDedupeKey(
  scholarshipId: string,
  universityId: string | null,
  programId: string | null,
): string {
  return `${scholarshipId}:u:${universityId ?? "-"}:p:${programId ?? "-"}`;
}

/**
 * How much to trust an inferred link.
 *
 * Deliberately capped below 1.0: rule inference is never a stated fact, and a
 * confidence of 1.0 would let an inferred row read as strongly as a cited one
 * anywhere the two are compared. Each predicate that fired narrows the claim,
 * so each adds; programme-level links score higher than university-level ones
 * because they were matched on more than location alone.
 */
export function linkConfidence(
  rules: ScholarshipRules,
  level: LinkLevel,
  /**
   * Whether the degree/field rules actually filtered this result set. They do
   * not when a programme-level match found nothing and the linker fell back to
   * a country-only university list — crediting them there would overstate a
   * link that location alone produced.
   */
  predicatesApplied = true,
): number {
  let score = 0.3;
  if (rules.countries.length > 0) score += 0.2;
  if (predicatesApplied && rules.degreeLevels.length > 0) score += 0.15;
  if (predicatesApplied && rules.fieldCategories.length > 0) score += 0.15;
  if (level === "PROGRAM") score += 0.05;
  return Math.min(Number(score.toFixed(2)), 0.85);
}

function programWhere(rules: ScholarshipRules) {
  return {
    ...(rules.degreeLevels.length
      ? { degreeLevel: { in: rules.degreeLevels as never[] } }
      : {}),
    ...(rules.fieldCategories.length
      ? { fieldCategory: { in: rules.fieldCategories as never[] } }
      : {}),
    ...(rules.countries.length
      ? { university: { country: { in: rules.countries } } }
      : {}),
  };
}

/**
 * How a university-level link was arrived at, which decides how tightly the
 * university set is filtered.
 *
 * "via-programs" means the scholarship does discriminate within a university
 * (it names a degree level or a subject) but there were too many matching
 * programmes to link individually. Dropping that constraint when stepping up a
 * level would link a STEM-only scholarship to universities with no STEM
 * programme at all, so it is carried over as an existence test instead.
 *
 * "country-only" means either the scholarship states no such constraint, or it
 * does but nothing in the catalogue matched. The second case is deliberately
 * not treated as "no university qualifies": programme coverage is far thinner
 * than university coverage — 1,295 programmes against 993 universities, almost
 * all of them German — so an empty programme match usually means the catalogue
 * is incomplete, not that the scholarship is unusable there.
 */
type UniversityFilterMode = "country-only" | "via-programs";

function universityWhere(rules: ScholarshipRules, mode: UniversityFilterMode) {
  const programConstraint =
    rules.degreeLevels.length || rules.fieldCategories.length
      ? {
          programs: {
            some: {
              ...(rules.degreeLevels.length
                ? { degreeLevel: { in: rules.degreeLevels as never[] } }
                : {}),
              ...(rules.fieldCategories.length
                ? { fieldCategory: { in: rules.fieldCategories as never[] } }
                : {}),
            },
          },
        }
      : {};

  if (mode === "via-programs") {
    return {
      ...(rules.countries.length ? { country: { in: rules.countries } } : {}),
      ...programConstraint,
    };
  }
  return {
    ...(rules.countries.length ? { country: { in: rules.countries } } : {}),
    // With no country bound the only remaining handle is "has a programme in
    // an eligible field", which is still a genuine restriction.
    ...(!rules.countries.length ? programConstraint : {}),
  };
}

/**
 * Picks the coarsest level that still says something true.
 *
 * A scholarship bounded only by country has nothing to say about which
 * *programme* within a university qualifies, so linking it to every programme
 * would multiply one fact into hundreds of identical ones. It links to the
 * university. A scholarship that also names a degree level or subject does
 * discriminate within a university, so it links to programmes — unless that
 * would blow the cap, in which case it steps back up to universities rather
 * than writing nothing. The degree and field rules are not lost by that
 * fallback: they stay on the scholarship and are still evaluated per student.
 */
interface LevelChoice {
  level: LinkLevel | null;
  count: number;
  /** Which university filter to reuse when resolving the actual rows. */
  mode: UniversityFilterMode;
  /** True when the degree/field rules genuinely narrowed the result set. */
  predicatesApplied: boolean;
}

async function chooseLevel(
  prisma: PrismaClient,
  rules: ScholarshipRules,
): Promise<LevelChoice> {
  const discriminatesWithinUniversity =
    rules.degreeLevels.length > 0 || rules.fieldCategories.length > 0;

  let mode: UniversityFilterMode = "country-only";
  let predicatesApplied = !rules.countries.length && discriminatesWithinUniversity;

  if (discriminatesWithinUniversity) {
    const programs = await prisma.program.count({ where: programWhere(rules) });
    if (programs > 0 && programs <= MAX_LINKS_PER_SCHOLARSHIP) {
      return { level: "PROGRAM", count: programs, mode, predicatesApplied: true };
    }
    if (programs > MAX_LINKS_PER_SCHOLARSHIP) {
      // Step up a level, but keep the constraint that made it specific.
      mode = "via-programs";
      predicatesApplied = true;
    }
    // programs === 0 keeps mode "country-only" — see UniversityFilterMode.
  }

  const universities = await prisma.university.count({ where: universityWhere(rules, mode) });
  if (universities === 0) return { level: null, count: 0, mode, predicatesApplied };
  if (universities > MAX_LINKS_PER_SCHOLARSHIP) {
    return { level: null, count: universities, mode, predicatesApplied };
  }
  return { level: "UNIVERSITY", count: universities, mode, predicatesApplied };
}

export async function inferApplicableLinks(
  prisma: PrismaClient,
  opts: { scholarshipId?: string; dryRun?: boolean; limit?: number } = {},
): Promise<InferenceRunResult> {
  const result: InferenceRunResult = {
    scholarshipsConsidered: 0,
    scholarshipsLinked: 0,
    linksWritten: 0,
    linksDeleted: 0,
    skippedNoRules: 0,
    skippedTooBroad: 0,
    skippedNoMatches: 0,
    outcomes: [],
  };

  const scholarships = await prisma.scholarship.findMany({
    where: opts.scholarshipId ? { id: opts.scholarshipId } : undefined,
    select: {
      id: true,
      name: true,
      country: true,
      primarySourceId: true,
      sourceUrl: true,
      authorityLevel: true,
      coverageType: true,
      eligibility: { select: { criterionType: true, valueList: true } },
    },
    ...(opts.limit ? { take: opts.limit } : {}),
  });

  for (const scholarship of scholarships) {
    result.scholarshipsConsidered += 1;
    const rules = deriveRules(scholarship.eligibility);

    // Scholarship.country is a fallback country bound: DAAD states the country
    // on the record itself even when the eligibility prose does not repeat it.
    if (rules.countries.length === 0 && scholarship.country) {
      rules.countries = [scholarship.country.toUpperCase()];
    }

    const outcome: ScholarshipLinkOutcome = {
      scholarshipId: scholarship.id,
      scholarshipName: scholarship.name,
      rules,
      level: null,
      linksWritten: 0,
      linksDeleted: 0,
    };

    if (!isLinkable(rules)) {
      outcome.skipped = "no-usable-rules";
      result.skippedNoRules += 1;
      result.outcomes.push(outcome);
      continue;
    }

    const { level, count, mode, predicatesApplied } = await chooseLevel(prisma, rules);
    outcome.candidateCount = count;
    if (!level) {
      outcome.skipped = count > 0 ? "too-broad" : "no-matches";
      if (count > 0) result.skippedTooBroad += 1;
      else result.skippedNoMatches += 1;
      result.outcomes.push(outcome);
      continue;
    }
    outcome.level = level;

    // Resolve the actual targets. Bounded by the cap checked above, so this
    // never loads an unbounded set into memory.
    const targets: Array<{ universityId: string | null; programId: string | null }> =
      level === "PROGRAM"
        ? (
            await prisma.program.findMany({
              where: programWhere(rules),
              select: { id: true, universityId: true },
              take: MAX_LINKS_PER_SCHOLARSHIP,
            })
          ).map((p) => ({ universityId: p.universityId, programId: p.id }))
        : (
            await prisma.university.findMany({
              where: universityWhere(rules, mode),
              select: { id: true },
              take: MAX_LINKS_PER_SCHOLARSHIP,
            })
          ).map((u) => ({ universityId: u.id, programId: null }));

    // A stated link always wins over an inferred one for the same triple.
    const explicit = await prisma.fundingOpportunity.findMany({
      where: { scholarshipId: scholarship.id, linkMethod: "EXPLICIT_SOURCE" },
      select: { dedupeKey: true },
    });
    const explicitKeys = new Set(explicit.map((e) => e.dedupeKey));

    const confidence = linkConfidence(rules, level, predicatesApplied);
    const inferenceBasis = {
      linkLevel: level,
      universityFilter: level === "UNIVERSITY" ? mode : undefined,
      // False means the degree/field rules are stated but did not narrow this
      // set — the catalogue had no matching programme, so location alone
      // produced these links.
      predicatesApplied,
      countries: rules.countries,
      degreeLevels: rules.degreeLevels,
      fieldCategories: rules.fieldCategories,
      // Stated by the source but not filterable — see ScholarshipRules.
      institutionTypesStated: rules.institutionTypes,
      unresolvedTokens: rules.unresolved,
      candidateCount: count,
    };

    const rows = targets
      .map((t) => ({
        ...t,
        dedupeKey: linkDedupeKey(scholarship.id, t.universityId, t.programId),
      }))
      .filter((r) => !explicitKeys.has(r.dedupeKey))
      .map((r) => ({
        dedupeKey: r.dedupeKey,
        scholarshipId: scholarship.id,
        universityId: r.universityId,
        programId: r.programId,
        fundingType: "EXTERNAL_APPLICABLE" as const,
        linkMethod: "RULE_INFERENCE" as const,
        coverageType: scholarship.coverageType,
        inferenceBasis,
        // Provenance is the scholarship's own page: that is where the rule
        // being expanded was stated. The inference itself is carried by
        // linkMethod and confidence, and verified stays false so nothing
        // downstream can mistake this for a corroborated fact.
        primarySourceId: scholarship.primarySourceId,
        sourceUrl: scholarship.sourceUrl,
        authorityLevel: scholarship.authorityLevel,
        confidence,
        verified: false,
        verificationStatus: "UNVERIFIED" as const,
      }));

    if (opts.dryRun) {
      outcome.linksWritten = rows.length;
      result.linksWritten += rows.length;
      result.scholarshipsLinked += rows.length > 0 ? 1 : 0;
      result.outcomes.push(outcome);
      continue;
    }

    const keep = rows.map((r) => r.dedupeKey);
    // Converge rather than accumulate: drop the inferred rows this run no
    // longer implies, add the ones it now does, and refresh the shared basis
    // on the rows that survived. Only ever touches RULE_INFERENCE rows.
    const deleted = await prisma.fundingOpportunity.deleteMany({
      where: {
        scholarshipId: scholarship.id,
        linkMethod: "RULE_INFERENCE",
        ...(keep.length ? { dedupeKey: { notIn: keep } } : {}),
      },
    });
    const created = await prisma.fundingOpportunity.createMany({
      data: rows,
      skipDuplicates: true,
    });
    if (keep.length) {
      await prisma.fundingOpportunity.updateMany({
        where: { scholarshipId: scholarship.id, linkMethod: "RULE_INFERENCE" },
        data: { confidence, inferenceBasis, coverageType: scholarship.coverageType },
      });
    }

    outcome.linksWritten = created.count;
    outcome.linksDeleted = deleted.count;
    result.linksWritten += created.count;
    result.linksDeleted += deleted.count;
    if (rows.length > 0) result.scholarshipsLinked += 1;
    result.outcomes.push(outcome);
  }

  return result;
}
