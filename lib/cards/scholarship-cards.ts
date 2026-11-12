import { prisma } from "@/lib/db";
import type { ApplicantGroup } from "@/lib/deadlines/applicant-group";
import type { AmountPer, InstitutionFace, ScholarshipCardData } from "@/lib/types/cards";
import { isCoverage } from "@/lib/ui/coverage";
import { LISTED_SCHOLARSHIP } from "@/lib/scholarships/listed";
import { institutionFaceSelect, toInstitutionFace } from "./faces";
import { matchInfo, upcomingDeadlineWhere, type ProgrammeMatchRow } from "./programme-cards";

export const scholarshipCardSelect = (now = new Date(), group: ApplicantGroup | null = null) =>
  ({
    id: true,
    name: true,
    providerName: true,
    coverageType: true,
    amount: true,
    amountCurrency: true,
    amountPeriod: true,
    verified: true,
    deadlineText: true,
    country: true,
    deadlines: {
      where: upcomingDeadlineWhere(now, group),
      orderBy: { date: "asc" },
      take: 1,
      select: { date: true },
    },
  }) as const;

/**
 * The institution behind a university's own scholarship, when the source
 * names exactly one: an officially linked OFFICIAL_UNIVERSITY_SCHOLARSHIP row.
 * Anything less certain keeps the provider's monogram instead of borrowing a
 * logo that might not be theirs.
 */
export async function providerInstitutions(scholarshipIds: string[]): Promise<Map<string, InstitutionFace>> {
  const out = new Map<string, InstitutionFace>();
  if (scholarshipIds.length === 0) return out;
  const rows = await prisma.fundingOpportunity.findMany({
    where: {
      scholarshipId: { in: scholarshipIds },
      linkMethod: "EXPLICIT_SOURCE",
      fundingType: "OFFICIAL_UNIVERSITY_SCHOLARSHIP",
      universityId: { not: null },
    },
    select: { scholarshipId: true, university: { select: institutionFaceSelect } },
  });
  const byScholarship = new Map<string, Map<string, NonNullable<(typeof rows)[number]["university"]>>>();
  for (const r of rows) {
    if (!r.university) continue;
    const m = byScholarship.get(r.scholarshipId) ?? new Map();
    m.set(r.university.id, r.university);
    byScholarship.set(r.scholarshipId, m);
  }
  for (const [id, unis] of byScholarship) {
    if (unis.size === 1) out.set(id, toInstitutionFace([...unis.values()][0]));
  }
  return out;
}

type ScholarshipRow = Awaited<ReturnType<typeof fetchScholarships>>[number];

async function fetchScholarships(ids: string[], now: Date, group: ApplicantGroup | null = null) {
  return prisma.scholarship.findMany({ where: { id: { in: ids }, ...LISTED_SCHOLARSHIP }, select: scholarshipCardSelect(now, group) });
}

const PER: Record<string, AmountPer> = { MONTH: "month", YEAR: "year", ONCE: "once", TOTAL: "total" };

/** The schema's MONTH / YEAR / ONCE / TOTAL as the card's `per`. */
export function amountPer(period: string | null | undefined): AmountPer | null {
  return (period && PER[period]) || null;
}

export function toScholarshipCard(
  s: ScholarshipRow,
  ctx: { matches: Map<string, ProgrammeMatchRow>; saved: Set<string> },
  provider: InstitutionFace | undefined,
): ScholarshipCardData {
  const amount = s.amount === null ? null : Number(s.amount);
  return {
    id: s.id,
    title: s.name,
    provider: { name: s.providerName, institution: provider ?? null },
    coverage: isCoverage(s.coverageType) ? s.coverageType : "UNKNOWN",
    amount: amount && amount > 0 && s.amountCurrency ? { value: amount, currency: s.amountCurrency, per: amountPer(s.amountPeriod) } : null,
    sourceVerified: s.verified,
    nextDeadline: s.deadlines[0]?.date?.toISOString() ?? null,
    deadlineText: s.deadlineText,
    match: matchInfo(ctx.matches.get(s.id), s.verified),
    saved: ctx.saved.has(s.id),
  };
}

export async function buildScholarshipCards(
  ids: string[],
  ctx: { matches: Map<string, ProgrammeMatchRow>; saved: Set<string>; now?: Date; applicantGroup?: ApplicantGroup | null },
): Promise<ScholarshipCardData[]> {
  if (ids.length === 0) return [];
  const now = ctx.now ?? new Date();
  const [rows, providers] = await Promise.all([fetchScholarships(ids, now, ctx.applicantGroup ?? null), providerInstitutions(ids)]);
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.flatMap((id) => {
    const row = byId.get(id);
    return row ? [toScholarshipCard(row, ctx, providers.get(id))] : [];
  });
}
