import type { FactorScore, MatchTarget, StudentProfileForMatching } from "../types";
import { compareNumeric } from "../compare";

/**
 * Compares the student's GPA against any stated MIN_GPA requirement or
 * eligibility criterion. Trusts the requirement's operator direction as
 * extracted (e.g. LTE for an inverted German 1.0-best scale) rather than
 * re-deriving grade-scale semantics here — see extraction's sourceQuote
 * discipline for why that's the right layer to get this correct.
 *
 * KNOWN LIMITATION: StudentProfile.currentGpa is a single raw number with no
 * semantic scale tag (just a numeric gpaScale like 4.0), so this factor
 * cannot tell whether a given requirement expects a standard 4.0-best scale
 * or an inverted one (e.g. German 1.0-best/4.0-pass) different from the
 * student's own. Comparing one currentGpa value against requirements from
 * sources with incompatible scale conventions can silently produce a wrong
 * verdict. Confirmed against real data: the same profile GPA correctly
 * passed a German-scale LTE requirement and correctly failed a standard-
 * scale GTE requirement it should have passed, for the right reason by
 * accident rather than a real scale-aware comparison. Fixing this properly
 * needs StudentProfile to capture which scale convention the student's GPA
 * is in (or a per-requirement scale-conversion step in normalization) —
 * out of scope for the MVP matching engine.
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
    "value" in gpaRequirement ? Number(gpaRequirement.value) : (gpaRequirement.numericValue ?? NaN);
  const meets = compareNumeric(gpaRequirement.operator, requiredValue, profile.currentGpa);

  if (meets === null) {
    return {
      factor: "ACADEMIC_COMPATIBILITY",
      score: null,
      weight: 0,
      explanation: "GPA requirement could not be evaluated against your profile.",
    };
  }

  return {
    factor: "ACADEMIC_COMPATIBILITY",
    score: meets ? 100 : 30,
    weight: 0,
    explanation: meets
      ? `Your GPA (${profile.currentGpa}) meets the stated requirement.`
      : `Your GPA (${profile.currentGpa}) does not meet the stated requirement (${gpaRequirement.operator} ${requiredValue}).`,
  };
}
