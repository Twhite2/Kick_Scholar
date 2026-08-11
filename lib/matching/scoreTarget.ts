import { academicCompatibility } from "./factors/academicCompatibility";
import { degreeCompatibility } from "./factors/degreeCompatibility";
import { fieldCompatibility } from "./factors/fieldCompatibility";
import { countryPreference } from "./factors/countryPreference";
import { languageCompatibility } from "./factors/languageCompatibility";
import { budgetCompatibility } from "./factors/budgetCompatibility";
import { scholarshipCriteria } from "./factors/scholarshipCriteria";
import { workExperience } from "./factors/workExperience";
import { classify } from "./classify";
import { explain } from "./explain";
import { DEFAULT_WEIGHTS, ENGINE_VERSION } from "./weights";
import type { FactorScore, MatchResult, MatchTarget, StudentProfileForMatching } from "./types";

const FACTOR_FNS = [
  academicCompatibility,
  degreeCompatibility,
  fieldCompatibility,
  countryPreference,
  languageCompatibility,
  budgetCompatibility,
  scholarshipCriteria,
  workExperience,
];

/**
 * Runs every factor for one (student, target) pair and aggregates into a
 * MatchResult. Null-scored factors are excluded from both the weighted
 * numerator and denominator — "not assessed," never a penalty or a free
 * pass. Pure and synchronous: all the DB/Prisma work happens in
 * runMatchForStudent.ts, which builds the MatchTarget this consumes.
 */
export function scoreTarget(
  profile: StudentProfileForMatching,
  target: MatchTarget,
  isVerified: boolean,
): MatchResult {
  const factorScores: FactorScore[] = FACTOR_FNS.map((fn) => {
    const result = fn(profile, target);
    return { ...result, weight: DEFAULT_WEIGHTS[result.factor] };
  });

  const assessed = factorScores.filter((f) => f.score !== null);
  const totalWeight = assessed.reduce((sum, f) => sum + f.weight, 0);
  const score =
    totalWeight > 0
      ? Math.round(assessed.reduce((sum, f) => sum + f.score! * f.weight, 0) / totalWeight)
      : 0;

  const matchStrength = classify(score, factorScores, isVerified);
  const { strengths, missingRequirements, warnings, recommendedActions } = explain(factorScores);

  return {
    score,
    matchStrength,
    factorScores,
    strengths,
    missingRequirements,
    warnings,
    recommendedActions,
    engineVersion: ENGINE_VERSION,
  };
}
