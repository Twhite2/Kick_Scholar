import type { FactorScore, MatchTarget, StudentProfileForMatching } from "../types";
import { compareNumeric } from "../compare";

export function workExperience(
  profile: StudentProfileForMatching,
  target: MatchTarget,
): FactorScore {
  const requirement =
    target.requirements.find((r) => r.requirementType === "WORK_EXPERIENCE") ??
    target.eligibility.find((e) => e.criterionType === "WORK_EXPERIENCE");

  if (!requirement) {
    return { factor: "WORK_EXPERIENCE", score: null, weight: 0, explanation: "No work experience requirement is published." };
  }

  const requiredMonths = "value" in requirement ? Number(requirement.value) : (requirement.numericValue ?? NaN);
  if (Number.isNaN(requiredMonths)) {
    return { factor: "WORK_EXPERIENCE", score: null, weight: 0, explanation: "Work experience requirement isn't a scoreable value." };
  }

  if (profile.workExperienceMonths === null) {
    return {
      factor: "WORK_EXPERIENCE",
      score: 0,
      weight: 0,
      explanation: `${requiredMonths} months of work experience required — none on file.`,
      missingProfileData: "work experience",
    };
  }

  const meets = compareNumeric(requirement.operator, requiredMonths, profile.workExperienceMonths);
  return {
    factor: "WORK_EXPERIENCE",
    score: meets ? 100 : 20,
    weight: 0,
    explanation: meets
      ? `Your work experience (${profile.workExperienceMonths} months) meets the requirement.`
      : `Your work experience (${profile.workExperienceMonths} months) is below the required ${requiredMonths} months.`,
  };
}
