import type { FactorScore, MatchTarget, StudentProfileForMatching } from "../types";
import { compareNumeric } from "../compare";
import { convertStudentGrade, requirementScale } from "../gradeConversion";

/**
 * Compares the student's GPA against any stated MIN_GPA requirement or
 * eligibility criterion, after converting the student's grade onto the
 * requirement's scale (see gradeConversion.ts). Trusts the requirement's
 * operator direction as extracted — German-scale rows arrive as LTE/LT,
 * corrected at load time by normaliseGradeDirections.
 */
export function academicCompatibility(
  profile: StudentProfileForMatching,
  target: MatchTarget,
): FactorScore {
  const gpaRequirement =
    target.requirements.find((r) => r.requirementType === "MIN_GPA") ??
    target.eligibility.find((e) => e.criterionType === "MIN_GPA");

  if (!gpaRequirement) {
    return {
      factor: "ACADEMIC_COMPATIBILITY",
      score: null,
      weight: 0,
      explanation: "No minimum GPA is published for this opportunity — cannot assess.",
    };
  }

  if (profile.currentGpa === null) {
    return {
      factor: "ACADEMIC_COMPATIBILITY",
      score: null,
      weight: 0,
      explanation: "Add your GPA to your profile to assess this factor.",
      missingProfileData: "GPA",
    };
  }

  const requiredValue =
    "value" in gpaRequirement
      ? Number(gpaRequirement.value.replace(",", "."))
      : (gpaRequirement.numericValue ?? NaN);

  // A value like "2.5 (German scale)" used to become NaN and compare false,
  // telling the student they'd failed a requirement nobody evaluated.
  if (!Number.isFinite(requiredValue)) {
    return {
      factor: "ACADEMIC_COMPATIBILITY",
      score: null,
      weight: 0,
      explanation: "A GPA requirement is stated but its value couldn't be read — check the official page.",
    };
  }

  const scale = requirementScale(
    gpaRequirement.operator,
    requiredValue,
    "unit" in gpaRequirement ? gpaRequirement.unit : null,
  );
  const studentGrade = convertStudentGrade(profile.currentGpa, profile.gpaScale, scale);

  if (studentGrade === null) {
    return {
      factor: "ACADEMIC_COMPATIBILITY",
      score: null,
      weight: 0,
      explanation:
        "This GPA requirement uses the German scale (1.0 best). Add your GPA scale to your profile so we can convert your grade.",
      missingProfileData: "GPA scale",
    };
  }

  const meets = compareNumeric(gpaRequirement.operator, requiredValue, studentGrade);

  if (meets === null) {
    return {
      factor: "ACADEMIC_COMPATIBILITY",
      score: null,
      weight: 0,
      explanation: "GPA requirement could not be evaluated against your profile.",
    };
  }

  const scaleName = scale.kind === "german" ? "the German scale" : `a ${scale.max}-point scale`;
  const yours =
    studentGrade === profile.currentGpa
      ? `Your GPA (${profile.currentGpa})`
      : `Your GPA (${profile.currentGpa}, about ${studentGrade} on ${scaleName})`;

  return {
    factor: "ACADEMIC_COMPATIBILITY",
    score: meets ? 100 : 30,
    weight: 0,
    explanation: meets
      ? `${yours} meets the stated requirement.`
      : `${yours} does not meet the stated requirement (${gpaRequirement.operator} ${requiredValue}).`,
  };
}
