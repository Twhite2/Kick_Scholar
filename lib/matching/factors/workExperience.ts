import type { FactorScore, MatchTarget, StudentProfileForMatching } from "../types";
import { compareNumeric } from "../compare";
import { durationToMonths, formatMonths } from "../duration";

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

  const rawValue = "value" in requirement ? Number(requirement.value) : (requirement.numericValue ?? NaN);
  if (Number.isNaN(rawValue)) {
    return { factor: "WORK_EXPERIENCE", score: null, weight: 0, explanation: "Work experience requirement isn't a scoreable value." };
  }

  // The stored number carries no scale of its own: most of these requirements
  // are stated in years, some in weeks, and a few are academic credits filed
  // under the wrong type. Comparing the bare number against a profile held in
  // months is wrong in both directions, so the unit (or, failing that, the
  // page's own sentence) decides.
  const unit = "unit" in requirement ? requirement.unit : null;
  const quote =
    "description" in requirement && typeof requirement.description === "string"
      ? requirement.description
      : "textValue" in requirement && typeof requirement.textValue === "string"
        ? requirement.textValue
        : null;
  const requiredMonths = durationToMonths(rawValue, unit ?? null, quote);

  if (requiredMonths === null) {
    return {
      factor: "WORK_EXPERIENCE",
      score: null,
      weight: 0,
      explanation:
        "A work experience requirement is stated, but not on a scale that can be compared to your profile.",
    };
  }

  if (profile.workExperienceMonths === null) {
    return {
      factor: "WORK_EXPERIENCE",
      score: 0,
      weight: 0,
      explanation: `${formatMonths(requiredMonths)} of work experience required — none on file.`,
      missingProfileData: "work experience",
    };
  }

  const meets = compareNumeric(requirement.operator, requiredMonths, profile.workExperienceMonths);
  return {
    factor: "WORK_EXPERIENCE",
    score: meets ? 100 : 20,
    weight: 0,
    explanation: meets
      ? `Your work experience (${formatMonths(profile.workExperienceMonths)}) meets the required ${formatMonths(requiredMonths)}.`
      : `Your work experience (${formatMonths(profile.workExperienceMonths)}) is below the required ${formatMonths(requiredMonths)}.`,
  };
}
