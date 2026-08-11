import type { FactorScore, MatchTarget, StudentProfileForMatching } from "../types";
import { compareNumeric } from "../compare";

export function languageCompatibility(
  profile: StudentProfileForMatching,
  target: MatchTarget,
): FactorScore {
  const requirement =
    target.requirements.find((r) => r.requirementType === "LANGUAGE_TEST") ??
    target.eligibility.find((e) => e.criterionType === "LANGUAGE");

  if (!requirement) {
    return {
      factor: "LANGUAGE_COMPATIBILITY",
      score: null,
      weight: 0,
      explanation: "No language test requirement is published for this opportunity.",
    };
  }

  const testName = "testName" in requirement ? requirement.testName : null;
  const requiredValue =
    "value" in requirement ? Number(requirement.value) : (requirement.numericValue ?? NaN);

  if (Number.isNaN(requiredValue)) {
    // A boolean/text-only language requirement (e.g. "passive knowledge of
    // English") — can't score numerically, but it isn't nothing either.
    return {
      factor: "LANGUAGE_COMPATIBILITY",
      score: null,
      weight: 0,
      explanation: "A language requirement is stated but isn't a scoreable test threshold.",
    };
  }

  const proficiency = testName
    ? profile.languageProficiencies.find((p) => p.testName.toLowerCase() === testName.toLowerCase())
    : profile.languageProficiencies[0];

  if (!proficiency || proficiency.score === null) {
    return {
      factor: "LANGUAGE_COMPATIBILITY",
      score: 0,
      weight: 0,
      explanation: `${testName ?? "A language test"} score of ${requirement.operator} ${requiredValue} is required — none on file.`,
      missingProfileData: testName ?? "language test score",
    };
  }

  const meets = compareNumeric(requirement.operator, requiredValue, proficiency.score);
  return {
    factor: "LANGUAGE_COMPATIBILITY",
    score: meets ? 100 : 20,
    weight: 0,
    explanation: meets
      ? `Your ${testName} score (${proficiency.score}) meets the requirement.`
      : `Your ${testName} score (${proficiency.score}) is below the required ${requirement.operator} ${requiredValue}.`,
  };
}
