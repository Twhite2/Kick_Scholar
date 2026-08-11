import { prisma } from "@/lib/db";
import { TARGET_COUNTRIES } from "@/lib/constants/countries";

export interface DashboardData {
  hasProfile: boolean;
  profileCompleteness: number;
  overallScore: number;
  programMatchCount: number;
  scholarshipMatchCount: number;
  fullyFundedCount: number;
  topMatch: { name: string; score: number; type: "PROGRAM" | "SCHOLARSHIP"; href: string } | null;
  strongestCountries: Array<{ country: string; countryName: string; avgScore: number }>;
  upcomingDeadlines: Array<{
    id: string;
    label: string;
    date: Date | null;
    dateText: string | null;
    daysRemaining: number | null;
    href: string;
  }>;
  missingRequirements: Array<{ label: string; affectedCount: number; recommendedAction: string | null }>;
  applicationCount: number;
  acceptedCount: number;
}

const EMPTY: DashboardData = {
  hasProfile: false,
  profileCompleteness: 0,
  overallScore: 0,
  programMatchCount: 0,
  scholarshipMatchCount: 0,
  fullyFundedCount: 0,
  topMatch: null,
  strongestCountries: [],
  upcomingDeadlines: [],
  missingRequirements: [],
  applicationCount: 0,
  acceptedCount: 0,
};

export async function getDashboardData(userId: string): Promise<DashboardData> {
  const profile = await prisma.studentProfile.findUnique({ where: { userId } });
  if (!profile) return EMPTY;

  const matches = await prisma.match.findMany({
    where: { userId },
    include: {
      program: { include: { university: true, deadlines: true } },
      scholarship: { include: { deadlines: true } },
    },
    orderBy: { score: "desc" },
  });

  const programMatches = matches.filter((m) => m.matchType === "PROGRAM");
  const scholarshipMatches = matches.filter((m) => m.matchType === "SCHOLARSHIP");

  const overallScore =
    matches.length > 0 ? Math.round(matches.reduce((sum, m) => sum + m.score, 0) / matches.length) : 0;

  const fullyFundedCount = programMatches.filter((m) => m.program?.tuitionType === "FREE").length;

  const top = matches[0];
  const topMatch = top
    ? {
        name: top.program?.name ?? top.scholarship?.name ?? "",
        score: top.score,
        type: top.matchType,
        href: top.matchType === "PROGRAM" ? `/programs/${top.programId}` : `/scholarships/${top.scholarshipId}`,
      }
    : null;

  const countryScores = new Map<string, number[]>();
  for (const m of programMatches) {
    const country = m.program?.university.country;
    if (!country) continue;
    countryScores.set(country, [...(countryScores.get(country) ?? []), m.score]);
  }
  const strongestCountries = [...countryScores.entries()]
    .map(([country, scores]) => ({
      country,
      countryName: TARGET_COUNTRIES[country] ?? country,
      avgScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    }))
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, 3);

  const now = new Date();
  const upcomingDeadlines = matches
    .filter((m) => m.matchStrength !== "MISSING_REQUIREMENT")
    .flatMap((m) => {
      const deadlines = m.program?.deadlines ?? m.scholarship?.deadlines ?? [];
      return deadlines.map((d) => ({
        id: d.id,
        label: m.program?.name ?? m.scholarship?.name ?? "",
        date: d.date,
        dateText: d.dateText,
        daysRemaining: d.date ? Math.ceil((d.date.getTime() - now.getTime()) / 86_400_000) : null,
        href: m.matchType === "PROGRAM" ? `/programs/${m.programId}` : `/scholarships/${m.scholarshipId}`,
      }));
    })
    .filter((d) => d.daysRemaining === null || d.daysRemaining >= 0)
    .sort((a, b) => (a.daysRemaining ?? Infinity) - (b.daysRemaining ?? Infinity))
    .slice(0, 5);

  const requirementCounts = new Map<string, { count: number; action: string | null }>();
  for (const m of matches) {
    for (const req of m.missingRequirements) {
      const existing = requirementCounts.get(req);
      requirementCounts.set(req, { count: (existing?.count ?? 0) + 1, action: existing?.action ?? m.recommendedActions[0] ?? null });
    }
  }
  const missingRequirements = [...requirementCounts.entries()]
    .map(([label, { count, action }]) => ({ label, affectedCount: count, recommendedAction: action }))
    .sort((a, b) => b.affectedCount - a.affectedCount)
    .slice(0, 4);

  const applications = await prisma.application.findMany({ where: { userId } });

  return {
    hasProfile: true,
    profileCompleteness: profile.profileCompleteness,
    overallScore,
    programMatchCount: programMatches.length,
    scholarshipMatchCount: scholarshipMatches.length,
    fullyFundedCount,
    topMatch,
    strongestCountries,
    upcomingDeadlines,
    missingRequirements,
    applicationCount: applications.length,
    acceptedCount: applications.filter((a) => a.status === "ACCEPTED").length,
  };
}
