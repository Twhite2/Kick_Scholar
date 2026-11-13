import type { FactorScore } from "./types";

/**
 * Weighted mean of the assessed factors, rounded. Null-scored factors are
 * excluded from both the numerator and the denominator — "not assessed",
 * never a penalty or a free pass.
 *
 * Extracted from scoreTarget so a projection ("what if this one requirement
 * were met?") is computed by exactly the same arithmetic as the real score.
 */
export function aggregateScore(factorScores: FactorScore[]): number {
  const assessed = factorScores.filter((f) => f.score !== null);
  const totalWeight = assessed.reduce((sum, f) => sum + f.weight, 0);
  return totalWeight > 0
    ? Math.round(assessed.reduce((sum, f) => sum + f.score! * f.weight, 0) / totalWeight)
    : 0;
}
