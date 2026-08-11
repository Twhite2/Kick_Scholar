import type { FactorScore, MatchTarget, StudentProfileForMatching } from "../types";

export function countryPreference(
  profile: StudentProfileForMatching,
  target: MatchTarget,
): FactorScore {
  if (profile.preferredCountries.length === 0) {
    return {
      factor: "COUNTRY_PREFERENCE",
      score: null,
      weight: 0,
      explanation: "No country preference set — not held against this match.",
    };
  }
  if (target.countries.length === 0) {
    return {
      factor: "COUNTRY_PREFERENCE",
      score: null,
      weight: 0,
      explanation: "No country is stated for this opportunity.",
    };
  }

  const preferred = new Set(profile.preferredCountries.map((c) => c.toUpperCase()));
  const matches = target.countries.some((c) => preferred.has(c.toUpperCase()));

  return {
    factor: "COUNTRY_PREFERENCE",
    score: matches ? 100 : 40,
    weight: 0,
    explanation: matches
      ? `Located in one of your preferred countries (${target.countries.join(", ")}).`
      : `Located in ${target.countries.join(", ")}, outside your preferred countries (${profile.preferredCountries.join(", ")}).`,
  };
}
