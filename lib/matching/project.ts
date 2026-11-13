import { aggregateScore } from "./aggregate";
import type { FactorKey, FactorScore } from "./types";

/**
 * The score a match would have if one requirement were met, everything else
 * unchanged (docs/ui-remodel.md §10.4).
 *
 * Pure re-aggregation of the factor scores the engine already stored, using
 * the engine's own weights and arithmetic — no estimate. The chosen factor is
 * treated as fully met (score 100, no hard fail). Scores of the other factors
 * are not touched, so this is exactly "close this one gap".
 */
export function projectScore(factorScores: FactorScore[], blocker: FactorKey): number {
  const projected = factorScores.map((f) =>
    f.factor === blocker ? { ...f, score: 100, hardFail: false, missingProfileData: undefined } : f,
  );
  return aggregateScore(projected);
}
