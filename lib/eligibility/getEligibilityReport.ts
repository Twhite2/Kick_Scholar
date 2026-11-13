import { prisma } from "@/lib/db";
import type { FactorScore, FactorKey } from "@/lib/matching/types";
import type { MatchStrength } from "@/lib/generated/prisma/enums";
import type { InstitutionFace } from "@/lib/types/cards";
import { institutionFaceSelect, providerFace, toInstitutionFace } from "@/lib/cards/faces";

/**
 * A summary of where a student stands, not a dump of everything they match.
 *
 * This page used to return every match — 1,337 of them against the current
 * catalogue — and render each as a row, which made it enormous and buried the
 * part that actually helps. It also presented blockers and suggested actions
 * as unordered sets accumulated across every match, so "no IELTS score on
 * file" sat beside a note affecting two opportunities with no way to tell
 * which mattered.
 *
 * Everything here is therefore either an aggregate or a bounded preview. The
 * full lists already exist on the Programs and Scholarships pages, which are
 * paginated and filterable; this page answers "how do I look, and what should
 * I fix first".
 */

/** Enough to show the shape of the answer; the full list lives elsewhere. */
const TOP_MATCH_LIMIT = 6;
/** Beyond this, a list of things to fix stops being a plan. */
const ADVICE_LIMIT = 5;

export interface RankedAdvice {
  text: string;
  /** Qualifies the headline, e.g. the span of thresholds asked for. */
  detail?: string;
  /** How many of the student's matches this applies to. Drives the order. */
  affects: number;
  /** A few of the affected opportunities, so the advice is checkable. */
  examples: Array<{ name: string; href: string }>;
}

/**
 * Collapses near-identical advice into one line.
 *
 * The raw messages are per-requirement, so a student with no English test saw
 * five separate blockers that differed only by threshold - "IELTS Academic
 * score of GTE 6.5", "IELTS score of GTE 6.5", "IELTS Academic score of GTE
 * 7" - which reads as repetition rather than as one thing to fix. Worse, none
 * of them named an opportunity, so there was no way to check the claim.
 *
 * Grouping is by test FAMILY rather than exact name: "IELTS" and "IELTS
 * Academic" are the same exam, a student sits it once, and the thresholds
 * differ only because the opportunities differ. The span is reported instead.
 */
const TEST_FAMILIES: Array<[RegExp, string]> = [
  [/\bIELTS\b/i, "IELTS"],
  [/\bTOEFL\b/i, "TOEFL"],
  [/\bDuolingo\b/i, "Duolingo English Test"],
  [/\bPTE\b/i, "PTE"],
  [/\b(Cambridge|CAE|CPE|C1 Advanced|C2 Proficiency)\b/i, "Cambridge English"],
  [/\b(TestDaF|DSH|Goethe|telc)\b/i, "German language test"],
  [/\bTestAS\b/i, "TestAS"],
  [/\b(GRE|GMAT)\b/i, "GRE or GMAT"],
];

function testFamily(text: string): string | null {
  for (const [pattern, family] of TEST_FAMILIES) {
    if (pattern.test(text)) return family;
  }
  return null;
}

/** "IELTS Academic score of GTE 6.5 is required" -> 6.5 */
function threshold(text: string): number | null {
  const m = text.match(/\b(?:GTE|GT|LTE|LT|EQ)\s+([\d.]+)/i);
  const n = m ? Number(m[1]) : NaN;
  return Number.isFinite(n) ? n : null;
}

export interface EligibilityReport {
  hasProfile: boolean;
  /** Mean score across every match. */
  overallScore: number;
  /** Mean across the strongest matches only — the realistic target set. */
  bestScore: number;
  totals: { all: number; programs: number; scholarships: number };
  /** How many matches fall into each strength band. */
  strengthCounts: Array<{ strength: MatchStrength; count: number }>;
  averageFactorScores: Array<{ factor: FactorKey; score: number | null; sampleExplanation: string }>;
  /** What blocks the most opportunities, worst first. */
  blockers: RankedAdvice[];
  blockerOverflow: number;
  /** What would unlock the most opportunities, biggest win first. */
  recommendedActions: RankedAdvice[];
  actionOverflow: number;
  topMatches: Array<{
    id: string;
    name: string;
    type: "PROGRAM" | "SCHOLARSHIP";
    score: number;
    matchStrength: MatchStrength;
    href: string;
    /** The institution (or provider) behind it, for its logo. */
    face: InstitutionFace;
  }>;
}

const EMPTY: EligibilityReport = {
  hasProfile: false,
  overallScore: 0,
  bestScore: 0,
  totals: { all: 0, programs: 0, scholarships: 0 },
  strengthCounts: [],
  averageFactorScores: [],
  blockers: [],
  blockerOverflow: 0,
  recommendedActions: [],
  actionOverflow: 0,
  topMatches: [],
};

interface AdviceOccurrence {
  text: string;
  name: string;
  href: string;
}

/** Up to this many named opportunities per line, enough to make it checkable. */
const EXAMPLE_LIMIT = 3;

/**
 * Groups occurrences, ranks by how many opportunities each affects, and
 * attaches a few of them by name so the student can see what is being
 * referred to rather than taking a count on trust.
 */
function rank(
  occurrences: AdviceOccurrence[],
  limit: number,
  kind: "blocker" | "action",
): { items: RankedAdvice[]; overflow: number } {
  const groups = new Map<
    string,
    { family: string | null; texts: Set<string>; thresholds: number[]; seen: Set<string>; examples: AdviceOccurrence[]; count: number }
  >();

  for (const o of occurrences) {
    const family = testFamily(o.text);
    // Same exam, same fix: one line. Anything else stays as its own message.
    const key = family ?? o.text;
    const g =
      groups.get(key) ??
      { family, texts: new Set<string>(), thresholds: [], seen: new Set<string>(), examples: [], count: 0 };
    g.count += 1;
    g.texts.add(o.text);
    const t = threshold(o.text);
    if (t !== null) g.thresholds.push(t);
    if (o.name && !g.seen.has(o.name) && g.examples.length < EXAMPLE_LIMIT) {
      g.seen.add(o.name);
      g.examples.push(o);
    }
    groups.set(key, g);
  }

  const items: RankedAdvice[] = [...groups.entries()].map(([key, g]) => {
    if (!g.family) {
      return { text: key, affects: g.count, examples: g.examples.map(({ name, href }) => ({ name, href })) };
    }
    const lo = Math.min(...g.thresholds);
    const hi = Math.max(...g.thresholds);
    // One exam can be quoted on several scales: pages state TOEFL iBT totals
    // (0-120), paper-based totals (310-677) and per-section sub-scores, so a
    // naive span reads "ranges from 4 to 570", which tells a student nothing.
    // When the ends are that far apart they are not the same measure, so say
    // it varies rather than print a meaningless range.
    const comparable = lo > 0 && hi / lo <= 10;
    const span =
      g.thresholds.length === 0
        ? undefined
        : lo === hi
          ? `Minimum score ${lo}`
          : comparable
            ? `Minimum score ranges from ${lo} to ${hi} across these opportunities`
            : "Required scores vary by opportunity and by which version of the test is accepted";
    return {
      text:
        kind === "blocker"
          ? `No ${g.family} score on your profile`
          : `Add your ${g.family} score`,
      detail: span,
      affects: g.count,
      examples: g.examples.map(({ name, href }) => ({ name, href })),
    };
  });

  items.sort((a, b) => b.affects - a.affects || a.text.localeCompare(b.text));
  return { items: items.slice(0, limit), overflow: Math.max(0, items.length - limit) };
}

export async function getEligibilityReport(userId: string): Promise<EligibilityReport> {
  const profile = await prisma.studentProfile.findUnique({ where: { userId } });
  if (!profile) return EMPTY;

  const matches = await prisma.match.findMany({
    where: { userId },
    orderBy: { score: "desc" },
    select: {
      id: true,
      score: true,
      matchStrength: true,
      matchType: true,
      programId: true,
      scholarshipId: true,
      factorScores: true,
      missingRequirements: true,
      recommendedActions: true,
      program: { select: { name: true, university: { select: institutionFaceSelect } } },
      scholarship: { select: { name: true, providerName: true } },
    },
  });

  if (matches.length === 0) return { ...EMPTY, hasProfile: true };

  const byFactor = new Map<FactorKey, { scores: number[]; explanation: string }>();
  const blockerOccurrences: AdviceOccurrence[] = [];
  const actionOccurrences: AdviceOccurrence[] = [];
  const strength = new Map<MatchStrength, number>();

  for (const m of matches) {
    for (const f of (m.factorScores as unknown as FactorScore[]) ?? []) {
      if (f.score === null) continue;
      const existing = byFactor.get(f.factor as FactorKey);
      byFactor.set(f.factor as FactorKey, {
        scores: [...(existing?.scores ?? []), f.score],
        explanation: existing?.explanation ?? f.explanation,
      });
    }
    // Recorded with the opportunity they came from, not just counted: the
    // same blocker on 400 matches is a different problem from one on two, and
    // naming a few of them lets the student verify rather than trust.
    const name = m.program?.name ?? m.scholarship?.name ?? "";
    const href =
      m.matchType === "PROGRAM" ? `/programs/${m.programId}` : `/scholarships/${m.scholarshipId}`;
    for (const r of m.missingRequirements) blockerOccurrences.push({ text: r, name, href });
    for (const a of m.recommendedActions) actionOccurrences.push({ text: a, name, href });
    strength.set(m.matchStrength, (strength.get(m.matchStrength) ?? 0) + 1);
  }

  const mean = (ns: number[]) =>
    ns.length === 0 ? 0 : Math.round(ns.reduce((a, b) => a + b, 0) / ns.length);

  // The average across everything is dragged down by opportunities the student
  // would never pursue. The average across their strongest is the number that
  // reflects what they could realistically aim at, so both are reported.
  const topScores = matches.slice(0, Math.max(TOP_MATCH_LIMIT, Math.ceil(matches.length * 0.1)));

  const { items: blockers, overflow: blockerOverflow } = rank(blockerOccurrences, ADVICE_LIMIT, "blocker");
  const { items: recommendedActions, overflow: actionOverflow } = rank(actionOccurrences, ADVICE_LIMIT, "action");

  const STRENGTH_ORDER: MatchStrength[] = [
    "STRONG_MATCH",
    "LIKELY_ELIGIBLE",
    "POTENTIAL_MATCH",
    "NEEDS_VERIFICATION",
    "MISSING_REQUIREMENT",
  ];

  return {
    hasProfile: true,
    overallScore: mean(matches.map((m) => m.score)),
    bestScore: mean(topScores.map((m) => m.score)),
    totals: {
      all: matches.length,
      programs: matches.filter((m) => m.matchType === "PROGRAM").length,
      scholarships: matches.filter((m) => m.matchType === "SCHOLARSHIP").length,
    },
    strengthCounts: STRENGTH_ORDER.filter((s) => strength.has(s)).map((s) => ({
      strength: s,
      count: strength.get(s)!,
    })),
    averageFactorScores: [...byFactor.entries()].map(([factor, { scores, explanation }]) => ({
      factor,
      score: mean(scores),
      sampleExplanation: explanation,
    })),
    blockers,
    blockerOverflow,
    recommendedActions,
    actionOverflow,
    topMatches: matches.slice(0, TOP_MATCH_LIMIT).map((m) => ({
      id: m.id,
      name: m.program?.name ?? m.scholarship?.name ?? "",
      type: m.matchType,
      score: m.score,
      matchStrength: m.matchStrength,
      href: m.matchType === "PROGRAM" ? `/programs/${m.programId}` : `/scholarships/${m.scholarshipId}`,
      face: m.program ? toInstitutionFace(m.program.university) : providerFace(m.scholarship?.providerName ?? ""),
    })),
  };
}
