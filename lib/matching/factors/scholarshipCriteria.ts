import type { FactorScore, MatchTarget, StudentProfileForMatching } from "../types";
import { compareNumeric, compareSetMembership } from "../compare";

/**
 * The comprehensive scholarship-only factor: walks every ScholarshipEligibility
 * row against the student profile, field by field. This is what lets
 * scholarships be matched independently of whether a university advertises
 * them — see the product's core "external scholarship that may fund this
 * program" distinction. Any explicit failing rule excludes the scholarship
 * entirely (hardFail); any rule where either side's data is missing is
 * tracked as a warning, never silently treated as a pass.
 */
export function scholarshipCriteria(
  profile: StudentProfileForMatching,
  target: MatchTarget,
): FactorScore {
  if (target.eligibility.length === 0) {
    // A programme carries no eligibility rules itself, but the scholarships
    // linked to it do. Answering "how many of these could you actually win?"
    // is the question this product exists for, so it is scored rather than
    // dismissed as not applicable.
    const linked = target.linkedScholarships;
    if (linked && linked.total > 0) {
      const share = Math.round((linked.eligible / linked.total) * 100);
      return {
        factor: "SCHOLARSHIP_ELIGIBILITY",
        score: share,
        weight: 0,
        explanation:
          linked.eligible === 0
            ? `None of the ${linked.total} scholarships linked to this programme match your profile.`
            : `You meet the stated criteria for ${linked.eligible} of ${linked.total} scholarships linked to this programme.`,
      };
    }
    return {
      factor: "SCHOLARSHIP_ELIGIBILITY",
      score: null,
      weight: 0,
      explanation:
        linked && linked.total === 0
          ? "No scholarships are linked to this programme yet."
          : "Not applicable.",
    };
  }

  const failures: string[] = [];
  const unassessed: string[] = [];
  let checkable = 0;
  let passed = 0;

  for (const criterion of target.eligibility) {
    let result: boolean | null = null;
    let label: string = criterion.criterionType;

    switch (criterion.criterionType) {
      case "NATIONALITY":
        result = compareSetMembership(criterion.valueList, profile.nationality);
        label = "nationality";
        if (profile.nationality === null) unassessed.push("nationality");
        break;
      case "FINANCIAL_NEED":
        result = profile.financialNeedSelfReported === null ? null : profile.financialNeedSelfReported;
        label = "financial need";
        if (profile.financialNeedSelfReported === null) unassessed.push("financial need status");
        break;
      case "COUNTRY_OF_STUDY":
        result =
          target.countries.length > 0
            ? compareSetMembership(criterion.valueList, target.countries[0])
            : null;
        label = "country of study";
        break;
      case "ACADEMIC_EXCELLENCE":
        // No single objective threshold — treated as informational, not scored.
        continue;
      default:
        // DEGREE_LEVEL / FIELD_OF_STUDY / MIN_GPA / WORK_EXPERIENCE / LANGUAGE /
        // UNIVERSITY are each covered by their own dedicated factor already —
        // avoid double-counting them here.
        continue;
    }

    if (result === null) continue;
    checkable += 1;
    if (result) {
      passed += 1;
    } else {
      failures.push(label);
    }
  }

  if (failures.length > 0) {
    return {
      factor: "SCHOLARSHIP_ELIGIBILITY",
      score: 0,
      weight: 0,
      hardFail: true,
      explanation: `Does not meet a stated eligibility requirement: ${failures.join(", ")}.`,
    };
  }

  if (checkable === 0) {
    return {
      factor: "SCHOLARSHIP_ELIGIBILITY",
      score: null,
      weight: 0,
      explanation:
        unassessed.length > 0
          ? `Add ${unassessed.join(" and ")} to your profile to assess eligibility.`
          : "No checkable eligibility criteria for your profile.",
      missingProfileData: unassessed[0],
    };
  }

  return {
    factor: "SCHOLARSHIP_ELIGIBILITY",
    score: Math.round((passed / checkable) * 100),
    weight: 0,
    explanation: `Meets ${passed}/${checkable} checkable eligibility criteria.`,
  };
}
