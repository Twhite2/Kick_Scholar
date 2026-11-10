import { cache } from "react";
import { prisma } from "@/lib/db";
import type { FactorScore } from "@/lib/matching/types";
import type {
  ApplicationSummary,
  DeadlineItem,
  DestinationItem,
  FeaturedProgramme,
  OneAwayItem,
  ProgrammeCardData,
  ScholarshipCardData,
  UnlockData,
} from "@/lib/types/cards";
import { blockerAction, unlockCopy } from "@/lib/ui/blockers";
import { COVERAGE_PHRASE, isCoverage } from "@/lib/ui/coverage";
import { applicationsCloseLine, formatMoney, lowerFirst, plural } from "@/lib/ui/format";
import { basisLine, buildReasons, languageRequirementText } from "@/lib/ui/reasons";
import { isStrength } from "@/lib/ui/strength";
import { institutionFaceSelect, providerFace, toInstitutionFace } from "@/lib/cards/faces";
import { buildProgrammeCardsWithRows, startOfToday, type ProgrammeMatchRow } from "@/lib/cards/programme-cards";
import { buildScholarshipCards, providerInstitutions } from "@/lib/cards/scholarship-cards";
import {
  LIMITS,
  countNewSince,
  selectApplications,
  selectClosingSoon,
  selectDestinations,
  selectFeatured,
  selectFunding,
  selectOneAway,
  selectStrongMatches,
  selectUnlock,
  type MatchLite,
  type OneAwayCandidate,
} from "./select";

/**
 * Everything Home renders, as plain serialisable props (§10.1, §10.2). One
 * query per rail at most; cards are hydrated in batches.
 */
export interface HomeFeed {
  firstName: string | null;
  hasProfile: boolean;
  previousVisitAt: string | null;
  featured: FeaturedProgramme[];
  featuredIsFallback: boolean;
  unlock: UnlockData | null;
  applications: ApplicationSummary[];
  strongMatches: ProgrammeCardData[];
  strongMatchesTotal: number;
  newStrongCount: number;
  closingSoon: DeadlineItem[];
  funding: ScholarshipCardData[];
  fundingTotal: number;
  oneAway: OneAwayItem[];
  destinations: DestinationItem[];
  /** Total qualifying matches, to tell "every rail empty" apart from "no profile". */
  matchCount: number;
}

const DAY = 86_400_000;

function gapSentence(c: OneAwayCandidate, req: { language: string | null; gpa: string | null; work: string | null }, profile: { workExperienceMonths: number | null }): string {
  switch (c.blocker.kind) {
    case "ENGLISH_TEST_MISSING":
    case "LANGUAGE_TEST_MISSING":
      return `${req.language ? `Needs ${req.language}` : "Needs a language test result"}. You have not added a test yet.`;
    case "ENGLISH_SCORE_LOW":
    case "LANGUAGE_SCORE_LOW":
      return `${req.language ? `Needs ${req.language}` : "Needs a higher language score"}. Your score on file is lower.`;
    case "CGPA_BELOW_MIN":
      return "Your grades are below the stated minimum. We convert your CGPA to their scale before comparing.";
    case "BUDGET_OVER":
      return "Tuition is more than your budget. Funding that covers tuition would close the gap.";
    case "WORK_EXPERIENCE_SHORT": {
      const have = profile.workExperienceMonths;
      return `${req.work ? `Needs ${req.work} of work experience` : "Needs more work experience"}.${have ? ` You have ${plural(have, "month")}.` : ""}`;
    }
    case "WORK_EXPERIENCE_MISSING":
      return `${req.work ? `Needs ${req.work} of work experience` : "Needs work experience"}. You have not added any yet.`;
    default:
      return c.blocker.explanation;
  }
}

export const getHomeFeed = cache(async (userId: string, now: Date = new Date()): Promise<HomeFeed> => {
  const [user, profile] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, homeLastVisitedAt: true } }),
    prisma.studentProfile.findUnique({
      where: { userId },
      select: {
        currentGpa: true,
        workExperienceMonths: true,
        preferredCountries: true,
        desiredFields: true,
        profileCompleteness: true,
        languageProficiencies: { select: { testName: true, score: true } },
      },
    }),
  ]);

  const firstName = user?.name?.trim().split(/\s+/)[0] ?? null;
  const previousVisit = user?.homeLastVisitedAt ?? null;
  const base = {
    firstName,
    previousVisitAt: previousVisit?.toISOString() ?? null,
    featured: [],
    featuredIsFallback: false,
    unlock: null,
    applications: [],
    strongMatches: [],
    strongMatchesTotal: 0,
    newStrongCount: 0,
    closingSoon: [],
    funding: [],
    fundingTotal: 0,
    oneAway: [],
    destinations: [],
    matchCount: 0,
  } satisfies Omit<HomeFeed, "hasProfile">;

  if (!profile) return { ...base, hasProfile: false };

  const reasonProfile = {
    currentGpa: profile.currentGpa,
    languageProficiencies: profile.languageProficiencies,
  };

  // 1. Every match, light: scores, strengths, factor scores, country, age.
  const [matchRows, savedRows, applicationRows] = await Promise.all([
    prisma.match.findMany({
      where: { userId },
      select: {
        id: true,
        matchType: true,
        programId: true,
        scholarshipId: true,
        score: true,
        matchStrength: true,
        factorScores: true,
        program: { select: { createdAt: true, university: { select: { country: true } } } },
        scholarship: { select: { createdAt: true } },
      },
    }),
    prisma.savedOpportunity.findMany({ where: { userId }, select: { programId: true, scholarshipId: true } }),
    prisma.application.findMany({
      where: { userId, status: { notIn: ["ACCEPTED", "REJECTED", "WITHDRAWN"] } },
      select: {
        id: true,
        status: true,
        updatedAt: true,
        opportunityType: true,
        programId: true,
        scholarshipId: true,
        documents: { select: { name: true, completed: true }, orderBy: { id: "asc" } },
        program: {
          select: {
            name: true,
            university: { select: institutionFaceSelect },
            deadlines: { where: { date: { gte: startOfToday(now) } }, orderBy: { date: "asc" }, take: 1, select: { date: true } },
          },
        },
        scholarship: {
          select: {
            name: true,
            providerName: true,
            deadlines: { where: { date: { gte: startOfToday(now) } }, orderBy: { date: "asc" }, take: 1, select: { date: true } },
          },
        },
      },
    }),
  ]);

  const matches: MatchLite[] = matchRows.flatMap((m) => {
    if (!isStrength(m.matchStrength)) return [];
    const targetId = m.matchType === "PROGRAM" ? m.programId : m.scholarshipId;
    if (!targetId) return [];
    return [
      {
        id: m.id,
        kind: m.matchType,
        targetId,
        score: Math.round(m.score),
        strength: m.matchStrength,
        factorScores: (m.factorScores as unknown as FactorScore[]) ?? [],
        createdAt: m.program?.createdAt ?? m.scholarship?.createdAt ?? null,
        countryCode: m.program?.university.country ?? null,
      },
    ];
  });

  const matchByTarget = new Map<string, ProgrammeMatchRow>(
    matchRows.map((m) => [(m.programId ?? m.scholarshipId)!, { score: m.score, matchStrength: m.matchStrength, factorScores: m.factorScores }]),
  );
  const savedProgrammes = new Set(savedRows.flatMap((s) => (s.programId ? [s.programId] : [])));
  const savedScholarships = new Set(savedRows.flatMap((s) => (s.scholarshipId ? [s.scholarshipId] : [])));
  const programmeCtx = { matches: matchByTarget, saved: savedProgrammes, profile: reasonProfile, now };

  // 2. Selections that need nothing more than the match rows.
  const strong = selectStrongMatches(matches);
  const funding = selectFunding(matches);
  const oneAway = selectOneAway(matches);
  const destinations = selectDestinations(matches);
  const qualifying = matches.filter((m) => m.strength !== "MISSING_REQUIREMENT");

  // 3. Deadlines within the window, for everything the student qualifies for.
  const windowEnd = new Date(startOfToday(now).getTime() + (LIMITS.closingWindowDays + 1) * DAY);
  const qualifyingProgrammeIds = qualifying.filter((m) => m.kind === "PROGRAM").map((m) => m.targetId);
  const qualifyingScholarshipIds = qualifying.filter((m) => m.kind === "SCHOLARSHIP").map((m) => m.targetId);
  const deadlineRows =
    qualifying.length === 0
      ? []
      : await prisma.applicationDeadline.findMany({
          where: {
            date: { gte: startOfToday(now), lt: windowEnd },
            OR: [
              ...(qualifyingProgrammeIds.length ? [{ programId: { in: qualifyingProgrammeIds } }] : []),
              ...(qualifyingScholarshipIds.length ? [{ scholarshipId: { in: qualifyingScholarshipIds } }] : []),
            ],
          },
          select: { programId: true, scholarshipId: true, date: true },
        });
  const matchByTargetLite = new Map(matches.map((m) => [m.targetId, m]));
  const closing = selectClosingSoon(
    deadlineRows.flatMap((d) => {
      const m = matchByTargetLite.get((d.programId ?? d.scholarshipId)!);
      return m && d.date ? [{ match: m, deadline: d.date }] : [];
    }),
    now,
  );

  // 4. Featured candidates: the top programme matches, judged with their
  //    deadlines and official funding. Hydrating the strong rail covers them.
  const featuredPool = (strong.items.length > 0
    ? strong.items
    : matches.filter((m) => m.kind === "PROGRAM" && m.strength !== "MISSING_REQUIREMENT").sort((a, b) => b.score - a.score).slice(0, 12)
  ).map((m) => m.targetId);
  const oneAwayProgrammeIds = oneAway.filter((c) => c.match.kind === "PROGRAM").map((c) => c.match.targetId);
  const programmeIds = [...new Set([...featuredPool, ...strong.items.map((m) => m.targetId), ...oneAwayProgrammeIds])];

  const [{ cards: programmeCards, rows: programmeRows, linked }, fundingCards, oneAwayScholarships] = await Promise.all([
    buildProgrammeCardsWithRows(programmeIds, programmeCtx),
    buildScholarshipCards(funding.items.map((m) => m.targetId), { matches: matchByTarget, saved: savedScholarships, now }),
    prisma.scholarship.findMany({
      where: { id: { in: oneAway.filter((c) => c.match.kind === "SCHOLARSHIP").map((c) => c.match.targetId) } },
      select: { id: true, name: true, providerName: true, eligibility: { select: { criterionType: true, numericValue: true, textValue: true } } },
    }),
  ]);
  const programmeCardById = new Map(programmeCards.map((c) => [c.id, c]));

  const featuredSelection = selectFeatured(
    featuredPool.flatMap((id) => {
      const m = matchByTargetLite.get(id);
      const card = programmeCardById.get(id);
      return m && card
        ? [{ match: m, hasOfficialFunding: (linked.get(id)?.length ?? 0) > 0, nextDeadline: card.nextDeadline ? new Date(card.nextDeadline) : null }]
        : [];
    }),
    now,
  );

  const featured: FeaturedProgramme[] = featuredSelection.flatMap(({ match }) => {
    const card = programmeCardById.get(match.targetId);
    const row = programmeRows.get(match.targetId);
    if (!card || !row) return [];
    const links = linked.get(match.targetId) ?? [];
    const covering = links.find((l) => l.coverage && isCoverage(l.coverage) && ["FULL_FUNDING", "FULL_TUITION", "PARTIAL_TUITION"].includes(l.coverage));
    let fundingLine: string | null = null;
    if (covering?.coverage && isCoverage(covering.coverage)) {
      fundingLine =
        covering.coverage === "FULL_FUNDING"
          ? `${covering.name} can fully fund your studies`
          : `${covering.name} can cover ${COVERAGE_PHRASE[covering.coverage]}`;
    } else if (card.tuition.kind === "free") {
      fundingLine = "No tuition fees";
    } else if (card.tuition.kind === "amount") {
      const money = formatMoney(card.tuition.amount, card.tuition.currency);
      fundingLine = card.tuition.per === "year" ? `${money} a year` : card.tuition.per === "semester" ? `${money} a semester` : money;
    }
    const longReasons = buildReasons(match.factorScores, {
      profile: reasonProfile,
      target: {
        kind: "PROGRAM",
        degreeLevel: row.degreeLevel,
        fieldCategory: row.fieldCategory,
        tuitionType: row.tuitionType,
        tuitionAmount: row.tuitionAmount === null ? null : Number(row.tuitionAmount),
        tuitionCurrency: row.tuitionCurrency,
        universityType: row.university.type,
        requirements: row.requirements,
      },
      linkedScholarshipName: links[0]?.name ?? null,
    });
    return [
      {
        ...card,
        longReasons,
        basis: basisLine(match.factorScores),
        fundingLine,
        deadlineLine: applicationsCloseLine(card.nextDeadline, now),
      },
    ];
  });

  // 5. Closing soon: titles and faces for at most twelve.
  const closingProgrammeIds = closing.filter((c) => c.match.kind === "PROGRAM").map((c) => c.match.targetId);
  const closingScholarshipIds = closing.filter((c) => c.match.kind === "SCHOLARSHIP").map((c) => c.match.targetId);
  const [closingProgrammes, closingScholarships, closingProviders] = await Promise.all([
    closingProgrammeIds.length
      ? prisma.program.findMany({ where: { id: { in: closingProgrammeIds } }, select: { id: true, name: true, university: { select: institutionFaceSelect } } })
      : [],
    closingScholarshipIds.length
      ? prisma.scholarship.findMany({ where: { id: { in: closingScholarshipIds } }, select: { id: true, name: true, providerName: true } })
      : [],
    providerInstitutions(closingScholarshipIds),
  ]);
  const closingProgrammeById = new Map(closingProgrammes.map((p) => [p.id, p]));
  const closingScholarshipById = new Map(closingScholarships.map((s) => [s.id, s]));
  const closingSoon: DeadlineItem[] = closing.flatMap(({ match, deadline }): DeadlineItem[] => {
    if (match.kind === "PROGRAM") {
      const p = closingProgrammeById.get(match.targetId);
      if (!p) return [];
      return [{ id: match.id, kind: "PROGRAM" as const, targetId: p.id, title: p.name, organisation: p.university.name, institution: toInstitutionFace(p.university), deadline: deadline.toISOString(), href: `/programs/${p.id}` }];
    }
    const s = closingScholarshipById.get(match.targetId);
    if (!s) return [];
    return [{ id: match.id, kind: "SCHOLARSHIP" as const, targetId: s.id, title: s.name, organisation: s.providerName, institution: closingProviders.get(s.id) ?? providerFace(s.providerName), deadline: deadline.toISOString(), href: `/scholarships/${s.id}` }];
  });

  // 6. One requirement away.
  const scholarshipById = new Map(oneAwayScholarships.map((s) => [s.id, s]));
  const oneAwayItems: OneAwayItem[] = oneAway.flatMap((c): OneAwayItem[] => {
    if (c.match.kind === "PROGRAM") {
      const row = programmeRows.get(c.match.targetId);
      if (!row) return [];
      const work = row.requirements.find((r) => r.requirementType === "WORK_EXPERIENCE");
      const gpa = row.requirements.find((r) => r.requirementType === "MIN_GPA");
      const req = {
        language: languageRequirementText({ profile: null, target: { kind: "PROGRAM", requirements: row.requirements } }),
        gpa: gpa?.value ?? null,
        work: work ? `${work.value} ${work.unit ?? "months"}` : null,
      };
      return [{ id: c.match.id, kind: "PROGRAM" as const, title: row.name, organisation: row.university.name, institution: toInstitutionFace(row.university), href: `/programs/${row.id}`, gap: gapSentence(c, req, profile), from: c.match.score, to: c.projected, action: blockerAction(c.blocker.kind) }];
    }
    const s = scholarshipById.get(c.match.targetId);
    if (!s) return [];
    const work = s.eligibility.find((e) => e.criterionType === "WORK_EXPERIENCE");
    const gpa = s.eligibility.find((e) => e.criterionType === "MIN_GPA");
    const req = {
      language: null,
      gpa: gpa?.numericValue ? String(gpa.numericValue) : null,
      work: work?.numericValue ? plural(work.numericValue, "month") : null,
    };
    return [{ id: c.match.id, kind: "SCHOLARSHIP" as const, title: s.name, organisation: s.providerName, institution: providerFace(s.providerName), href: `/scholarships/${s.id}`, gap: gapSentence(c, req, profile), from: c.match.score, to: c.projected, action: blockerAction(c.blocker.kind) }];
  });

  // 7. Unlock card.
  const unlockPick = selectUnlock(matches, {
    preferredCountries: profile.preferredCountries,
    desiredFields: profile.desiredFields,
    completeness: profile.profileCompleteness,
  });
  let unlock: UnlockData | null = unlockPick ? unlockCopy(unlockPick.kind, unlockPick.counts) : null;
  if (!unlock && profile.profileCompleteness < 1) {
    const added = Math.round(profile.profileCompleteness * 8);
    unlock = {
      title: "Finish your profile to sharpen your matches",
      body: `${added} of 8 details added.`,
      primary: { label: "Finish profile", href: "/profile" },
    };
  }

  // 8. Applications in progress.
  const apps = selectApplications(
    applicationRows.map((a) => ({
      ...a,
      nextDeadline: a.program?.deadlines[0]?.date ?? a.scholarship?.deadlines[0]?.date ?? null,
    })),
    now,
  );
  const applications: ApplicationSummary[] = apps.map((a) => {
    const done = a.documents.filter((d) => d.completed).length;
    const next = a.documents.find((d) => !d.completed)?.name ?? null;
    return {
      id: a.id,
      title: a.program?.name ?? a.scholarship?.name ?? "",
      organisation: a.program?.university.name ?? a.scholarship?.providerName ?? "",
      institution: a.program ? toInstitutionFace(a.program.university) : a.scholarship ? providerFace(a.scholarship.providerName) : null,
      stage: a.status,
      done,
      total: a.documents.length,
      deadline: a.nextDeadline?.toISOString() ?? null,
      next: next ? lowerFirst(next) : null,
    };
  });

  return {
    ...base,
    hasProfile: true,
    featured,
    featuredIsFallback: strong.items.length === 0 && featured.length > 0,
    unlock,
    applications,
    strongMatches: strong.items.flatMap((m) => programmeCardById.get(m.targetId) ?? []),
    strongMatchesTotal: strong.total,
    newStrongCount: countNewSince(strong.items, previousVisit),
    closingSoon,
    funding: fundingCards,
    fundingTotal: funding.total,
    oneAway: oneAwayItems,
    destinations,
    matchCount: qualifying.length,
  };
});

/** Signed-out-of-profile Home: popular destinations and fully funded scholarships. */
export async function getStarterFeed() {
  const [countries, scholarships] = await Promise.all([
    prisma.$queryRaw<Array<{ country: string; count: bigint }>>`
      SELECT u."country" AS country, COUNT(*)::bigint AS count
      FROM "Program" p JOIN "University" u ON u."id" = p."universityId"
      GROUP BY u."country" ORDER BY count DESC LIMIT 10`,
    prisma.scholarship.findMany({
      where: { coverageType: "FULL_FUNDING" },
      orderBy: [{ verified: "desc" }, { confidence: "desc" }, { name: "asc" }],
      take: 12,
      select: { id: true },
    }),
  ]);
  const funding = await buildScholarshipCards(
    scholarships.map((s) => s.id),
    { matches: new Map(), saved: new Set() },
  );
  return {
    destinations: countries.map((c) => ({ countryCode: c.country, count: Number(c.count) })),
    funding,
  };
}
