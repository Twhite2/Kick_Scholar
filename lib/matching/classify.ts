import type { FactorScore, MatchResult } from "./types";

/**
 * Turns an aggregate score + verification status into a MatchStrength.
 * Two rules take priority over the raw score:
 *   - any factor's hardFail always classifies as MISSING_REQUIREMENT,
 *     regardless of how high the rest of the score is.
 *   - a high score built on unverified data classifies as
 *     NEEDS_VERIFICATION, never STRONG_MATCH or LIKELY_ELIGIBLE — the
 *     product must never claim "you're eligible" on unconfirmed facts.
 */
export function classify(
  score: number,
  factorScores: FactorScore[],
  isVerified: boolean,
): MatchResult["matchStrength"] {
  if (factorScores.some((f) => f.hardFail)) return "MISSING_REQUIREMENT";

  if (!isVerified) {
    return score >= 70 ? "NEEDS_VERIFICATION" : "POTENTIAL_MATCH";
  }

  if (score >= 85) return "STRONG_MATCH";
  if (score >= 70) return "LIKELY_ELIGIBLE";
  if (score >= 45) return "POTENTIAL_MATCH";
  return "MISSING_REQUIREMENT";
}
