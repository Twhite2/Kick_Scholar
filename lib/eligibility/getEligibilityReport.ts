import { prisma } from "@/lib/db";
import type { FactorScore, FactorKey } from "@/lib/matching/types";
import type { MatchStrength } from "@/lib/generated/prisma/enums";

export interface EligibilityReport {
  hasProfile: boolean;
  overallScore: number;
  averageFactorScores: Array<{ factor: FactorKey; score: number | null; sampleExplanation: string }>;
  missingRequirements: string[];
  recommendedActions: string[];
  matches: Array<{
    id: string;
    name: string;
    type: "PROGRAM" | "SCHOLARSHIP";
    score: number;
    matchStrength: MatchStrength;
    href: string;
  }>;
}

export async function getEligibilityReport(userId: string): Promise<EligibilityReport> {
  const profile = await prisma.studentProfile.findUnique({ where: { userId } });
  if (!profile) {
    return {
      hasProfile: false,
      overallScore: 0,
      averageFactorScores: [],
      missingRequirements: [],
      recommendedActions: [],
      matches: [],
    };
  }

  const matches = await prisma.match.findMany({
    where: { userId },
    include: { program: true, scholarship: true },
    orderBy: { score: "desc" },
  });

  const overallScore =
    matches.length > 0 ? Math.round(matches.reduce((sum, m) => sum + m.score, 0) / matches.length) : 0;

  const byFactor = new Map<FactorKey, { scores: number[]; explanation: string }>();
  const missingRequirements = new Set<string>();
  const recommendedActions = new Set<string>();

  for (const m of matches) {
    const factorScores = (m.factorScores as unknown as FactorScore[]) ?? [];
    for (const f of factorScores) {
      if (f.score === null) continue;
      const existing = byFactor.get(f.factor as FactorKey);
      byFactor.set(f.factor as FactorKey, {
        scores: [...(existing?.scores ?? []), f.score],
        explanation: existing?.explanation ?? f.explanation,
      });
    }
    m.missingRequirements.forEach((r) => missingRequirements.add(r));
    m.recommendedActions.forEach((a) => recommendedActions.add(a));
  }

  const averageFactorScores = [...byFactor.entries()].map(([factor, { scores, explanation }]) => ({
    factor,
    score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    sampleExplanation: explanation,
  }));

  return {
    hasProfile: true,
    overallScore,
    averageFactorScores,
    missingRequirements: [...missingRequirements],
    recommendedActions: [...recommendedActions],
    matches: matches.map((m) => ({
      id: m.id,
      name: m.program?.name ?? m.scholarship?.name ?? "",
      type: m.matchType,
      score: m.score,
      matchStrength: m.matchStrength,
      href: m.matchType === "PROGRAM" ? `/programs/${m.programId}` : `/scholarships/${m.scholarshipId}`,
    })),
  };
}
