import type { FactorScore, MatchTarget, StudentProfileForMatching } from "../types";

export function budgetCompatibility(
  profile: StudentProfileForMatching,
  target: MatchTarget,
): FactorScore {
  if (!target.tuitionType) {
    return { factor: "BUDGET_COMPATIBILITY", score: null, weight: 0, explanation: "No tuition information is published." };
  }

  if (target.tuitionType === "FREE") {
    return { factor: "BUDGET_COMPATIBILITY", score: 100, weight: 0, explanation: "No tuition fee." };
  }

  if (target.tuitionType === "UNKNOWN") {
    return {
      factor: "BUDGET_COMPATIBILITY",
      score: 60,
      weight: 0,
      explanation: "Tuition isn't published for this program yet — verify directly with the institution before applying.",
    };
  }

  if (target.tuitionType === "VARIES") {
    return {
      factor: "BUDGET_COMPATIBILITY",
      score: 60,
      weight: 0,
      explanation: "Tuition varies (e.g. by nationality) — verify your specific rate directly with the institution.",
    };
  }

  // PAID
  if (profile.budgetMaxPerYear === null) {
    return {
      factor: "BUDGET_COMPATIBILITY",
      score: null,
      weight: 0,
      explanation: "Add your budget to assess affordability.",
      missingProfileData: "budget",
    };
  }
  if (target.tuitionAmount === null) {
    return {
      factor: "BUDGET_COMPATIBILITY",
      score: 60,
      weight: 0,
      explanation: "Tuition is stated as paid, but no amount is published — verify directly.",
    };
  }
  if (target.tuitionCurrency && profile.budgetCurrency && target.tuitionCurrency !== profile.budgetCurrency) {
    return {
      factor: "BUDGET_COMPATIBILITY",
      score: 60,
      weight: 0,
      explanation: `Tuition is in ${target.tuitionCurrency}, your budget is in ${profile.budgetCurrency} — currency conversion not yet supported, verify directly.`,
    };
  }

  const withinBudget = target.tuitionAmount <= profile.budgetMaxPerYear;
  return {
    factor: "BUDGET_COMPATIBILITY",
    score: withinBudget ? 100 : 15,
    weight: 0,
    explanation: withinBudget
      ? `Tuition (${target.tuitionAmount} ${target.tuitionCurrency ?? ""}) is within your budget.`
      : `Tuition (${target.tuitionAmount} ${target.tuitionCurrency ?? ""}) exceeds your stated budget (${profile.budgetMaxPerYear} ${profile.budgetCurrency ?? ""}).`,
  };
}
