import { prisma } from "@/lib/db";
import type { FactorScore } from "@/lib/matching/types";
import type { MatchInfo, ProgrammeCardData, Tuition } from "@/lib/types/cards";
import { COVERAGE_LABEL, isCoverage } from "@/lib/ui/coverage";
import { formatMoney } from "@/lib/ui/format";
import { buildReasons, type ReasonContext } from "@/lib/ui/reasons";
import { isStrength } from "@/lib/ui/strength";
import { institutionFaceSelect, toInstitutionFace } from "./faces";

/**
 * Builds programme poster data for a list of ids, in the order given, in two
 * queries regardless of how many cards: the programmes with their university
 * and next deadline, then the officially linked funding for all of them.
 */

export interface ProgrammeMatchRow {
  score: number;
  matchStrength: string;
  factorScores: unknown;
}

export interface CardContext {
  matches: Map<string, ProgrammeMatchRow>;
  saved: Set<string>;
  profile: ReasonContext["profile"];
  now?: Date;
}

export function startOfToday(now = new Date()): Date {
  // Lagos is UTC+1 all year; the start of its day is 23:00 UTC the day before.
  const d = new Date(now.getTime() + 60 * 60 * 1000);
  d.setUTCHours(0, 0, 0, 0);
  return new Date(d.getTime() - 60 * 60 * 1000);
}

export const programmeCardSelect = (now = new Date()) =>
  ({
    id: true,
    name: true,
    degreeLevel: true,
    durationMonths: true,
    fieldCategory: true,
    tuitionType: true,
    tuitionAmount: true,
    tuitionCurrency: true,
    tuitionPeriod: true,
    verified: true,
    universityId: true,
    university: { select: { ...institutionFaceSelect, type: true } },
    requirements: { select: { requirementType: true, testName: true, value: true, unit: true } },
    deadlines: {
      where: { date: { gte: startOfToday(now) } },
      orderBy: { date: "asc" },
      take: 1,
      select: { date: true },
    },
  }) as const;

type ProgrammeRow = Awaited<ReturnType<typeof fetchProgrammes>>[number];

async function fetchProgrammes(ids: string[], now: Date) {
  return prisma.program.findMany({ where: { id: { in: ids } }, select: programmeCardSelect(now) });
}

export function tuitionOf(p: {
  tuitionType: string;
  tuitionAmount: unknown;
  tuitionCurrency: string | null;
  tuitionPeriod: string | null;
}): Tuition {
  if (p.tuitionType === "FREE") return { kind: "free" };
  if (p.tuitionType === "VARIES") return { kind: "varies" };
  const amount = p.tuitionAmount === null || p.tuitionAmount === undefined ? null : Number(p.tuitionAmount);
  if (p.tuitionType === "PAID" && amount && p.tuitionCurrency) {
    const per =
      p.tuitionPeriod === "PER_YEAR" ? "year" : p.tuitionPeriod === "PER_SEMESTER" ? "semester" : p.tuitionPeriod === "PER_PROGRAM" ? "total" : null;
    return { kind: "amount", amount, currency: p.tuitionCurrency, per };
  }
  return { kind: "unknown" };
}

export function tuitionLabel(t: Tuition): string | null {
  switch (t.kind) {
    case "free":
      return "No tuition fees";
    case "amount": {
      const money = formatMoney(t.amount, t.currency);
      return t.per === "year" ? `${money} a year` : t.per === "semester" ? `${money} a semester` : t.per === "total" ? `${money} in total` : money;
    }
    case "varies":
      return "Tuition varies";
    case "unknown":
      return null;
  }
}

export function matchInfo(row: ProgrammeMatchRow | undefined, verified: boolean): MatchInfo | null {
  if (!row || !isStrength(row.matchStrength)) return null;
  return { score: Math.round(row.score), strength: row.matchStrength, verified };
}

export interface LinkedFunding {
  name: string;
  coverage: string | null;
}

/** Officially linked scholarships per programme, including university-wide ones. */
export async function officialFundingFor(
  programmes: Array<{ id: string; universityId: string }>,
): Promise<Map<string, LinkedFunding[]>> {
  const out = new Map<string, LinkedFunding[]>();
  if (programmes.length === 0) return out;
  const rows = await prisma.fundingOpportunity.findMany({
    where: {
      linkMethod: "EXPLICIT_SOURCE",
      OR: [
        { programId: { in: programmes.map((p) => p.id) } },
        { universityId: { in: [...new Set(programmes.map((p) => p.universityId))] }, programId: null },
      ],
    },
    orderBy: { confidence: "desc" },
    select: {
      programId: true,
      universityId: true,
      coverageType: true,
      scholarship: { select: { name: true, coverageType: true } },
    },
  });
  for (const p of programmes) {
    const linked = rows
      .filter((r) => r.programId === p.id || (r.programId === null && r.universityId === p.universityId))
      .map((r) => ({ name: r.scholarship.name, coverage: r.coverageType ?? r.scholarship.coverageType }));
    if (linked.length > 0) out.set(p.id, linked);
  }
  return out;
}

const TUITION_COVERING = new Set(["FULL_FUNDING", "FULL_TUITION", "PARTIAL_TUITION"]);

/** The single most useful funding fact for a poster (§9.1.5). */
export function bestFundingFor(tuition: Tuition, linked: LinkedFunding[] | undefined): ProgrammeCardData["bestFunding"] {
  if (tuition.kind === "free") return { label: "No tuition fees", positive: true };
  const covering = linked?.find((l) => l.coverage && TUITION_COVERING.has(l.coverage));
  if (covering?.coverage && isCoverage(covering.coverage)) {
    return { label: `${COVERAGE_LABEL[covering.coverage]} scholarship`, positive: true };
  }
  if (linked && linked.length > 0) return { label: "Scholarship available", positive: true };
  const label = tuitionLabel(tuition);
  return label ? { label, positive: false } : null;
}

export function toProgrammeCard(
  p: ProgrammeRow,
  ctx: CardContext,
  linked: LinkedFunding[] | undefined,
): ProgrammeCardData {
  const tuition = tuitionOf(p);
  const matchRow = ctx.matches.get(p.id);
  const factorScores = (matchRow?.factorScores as FactorScore[] | undefined) ?? [];
  const reasonCtx: ReasonContext = {
    profile: ctx.profile,
    target: {
      kind: "PROGRAM",
      degreeLevel: p.degreeLevel,
      fieldCategory: p.fieldCategory,
      tuitionType: p.tuitionType,
      tuitionAmount: p.tuitionAmount === null ? null : Number(p.tuitionAmount),
      tuitionCurrency: p.tuitionCurrency,
      universityType: p.university.type,
      requirements: p.requirements,
    },
    linkedScholarshipName: linked?.[0]?.name ?? null,
  };
  return {
    id: p.id,
    title: p.name,
    degree: p.degreeLevel,
    durationMonths: p.durationMonths,
    institution: toInstitutionFace(p.university),
    tuition,
    bestFunding: bestFundingFor(tuition, linked),
    nextDeadline: p.deadlines[0]?.date?.toISOString() ?? null,
    match: matchInfo(matchRow, p.verified),
    reasons: factorScores.length > 0 ? buildReasons(factorScores, reasonCtx, { short: true }) : [],
    saved: ctx.saved.has(p.id),
  };
}

/** Cards for `ids`, in that order. Unknown ids are skipped. */
export async function buildProgrammeCards(ids: string[], ctx: CardContext): Promise<ProgrammeCardData[]> {
  if (ids.length === 0) return [];
  const now = ctx.now ?? new Date();
  const rows = await fetchProgrammes(ids, now);
  const linked = await officialFundingFor(rows);
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.flatMap((id) => {
    const row = byId.get(id);
    return row ? [toProgrammeCard(row, ctx, linked.get(id))] : [];
  });
}

/** Same, but also returns the raw rows (the billboard needs requirements and links). */
export async function buildProgrammeCardsWithRows(ids: string[], ctx: CardContext) {
  if (ids.length === 0) return { cards: [] as ProgrammeCardData[], rows: new Map<string, ProgrammeRow>(), linked: new Map<string, LinkedFunding[]>() };
  const now = ctx.now ?? new Date();
  const rows = await fetchProgrammes(ids, now);
  const linked = await officialFundingFor(rows);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const cards = ids.flatMap((id) => {
    const row = byId.get(id);
    return row ? [toProgrammeCard(row, ctx, linked.get(id))] : [];
  });
  return { cards, rows: byId, linked };
}
