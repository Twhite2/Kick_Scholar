import { describe, expect, it } from "vitest";
import { scoreTarget } from "../scoreTarget";
import { baseProfile, baseProgramTarget, baseScholarshipTarget } from "./fixtures";

describe("missing GPA", () => {
  it("excludes academic compatibility from scoring rather than penalizing when the student hasn't entered a GPA", () => {
    const target = baseProgramTarget({
      requirements: [
        { requirementType: "MIN_GPA", testName: null, operator: "GTE", value: "3.0", unit: null, verified: true },
      ],
    });
    const result = scoreTarget(baseProfile({ currentGpa: null }), target, true);

    const academic = result.factorScores.find((f) => f.factor === "ACADEMIC_COMPATIBILITY")!;
    expect(academic.score).toBeNull();
    expect(academic.missingProfileData).toBe("GPA");
    expect(result.recommendedActions.some((a) => /gpa/i.test(a))).toBe(true);
    // Excluded from the denominator, not counted as a failure — score should
    // still be computed from the remaining assessable factors, not crushed.
    expect(result.score).toBeGreaterThan(0);
  });
});

describe("exact language match", () => {
  it("scores 100 on language compatibility when the student's IELTS exactly meets the threshold", () => {
    const target = baseProgramTarget({
      requirements: [
        { requirementType: "LANGUAGE_TEST", testName: "IELTS", operator: "GTE", value: "6.5", unit: null, verified: true },
      ],
    });
    const profile = baseProfile({
      languageProficiencies: [{ testName: "IELTS", score: 6.5, cefrLevel: null }],
    });
    const result = scoreTarget(profile, target, true);

    const language = result.factorScores.find((f) => f.factor === "LANGUAGE_COMPATIBILITY")!;
    expect(language.score).toBe(100);
  });

  it("flags a missing IELTS score as a real, actionable gap rather than excluding it", () => {
    const target = baseProgramTarget({
      requirements: [
        { requirementType: "LANGUAGE_TEST", testName: "IELTS", operator: "GTE", value: "6.5", unit: null, verified: true },
      ],
    });
    const result = scoreTarget(baseProfile(), target, true);

    const language = result.factorScores.find((f) => f.factor === "LANGUAGE_COMPATIBILITY")!;
    expect(language.score).toBe(0);
    expect(result.missingRequirements.some((m) => /IELTS/.test(m))).toBe(true);
  });
});

describe("nationality exclusion", () => {
  it("hard-fails a scholarship when the student's nationality isn't in the eligible list, regardless of other factors", () => {
    const target = baseScholarshipTarget({
      eligibility: [
        {
          criterionType: "NATIONALITY",
          operator: "IN_LIST",
          valueList: ["Kenya", "Nigeria", "Ghana"],
          numericValue: null,
          textValue: null,
          verified: true,
        },
      ],
    });
    const profile = baseProfile({ nationality: "France" });
    const result = scoreTarget(profile, target, true);

    expect(result.matchStrength).toBe("MISSING_REQUIREMENT");
    expect(result.factorScores.some((f) => f.hardFail)).toBe(true);
    expect(result.missingRequirements.length).toBeGreaterThan(0);
  });

  it("does not hard-fail when the student's nationality is in the eligible list", () => {
    const target = baseScholarshipTarget({
      eligibility: [
        {
          criterionType: "NATIONALITY",
          operator: "IN_LIST",
          valueList: ["Kenya", "Nigeria", "Ghana"],
          numericValue: null,
          textValue: null,
          verified: true,
        },
      ],
    });
    const profile = baseProfile({ nationality: "Nigeria" });
    const result = scoreTarget(profile, target, true);

    expect(result.factorScores.some((f) => f.hardFail)).toBe(false);
  });
});

describe("high score but unverified", () => {
  it("classifies as NEEDS_VERIFICATION rather than STRONG_MATCH when the underlying data isn't verified", () => {
    // A profile that would otherwise ace every factor.
    const target = baseProgramTarget({
      requirements: [
        { requirementType: "MIN_GPA", testName: null, operator: "GTE", value: "3.0", unit: null, verified: false },
      ],
    });
    const profile = baseProfile({
      currentGpa: 3.8,
      preferredCountries: ["DE"],
      budgetMaxPerYear: 0,
    });

    const verified = scoreTarget(profile, target, true);
    const unverified = scoreTarget(profile, target, false);

    expect(verified.score).toBe(unverified.score); // same inputs, same raw score
    expect(unverified.matchStrength).toBe("NEEDS_VERIFICATION");
    expect(unverified.matchStrength).not.toBe("STRONG_MATCH");
    expect(unverified.matchStrength).not.toBe("LIKELY_ELIGIBLE");
  });
});

describe("unknown budget / tuition", () => {
  it("treats UNKNOWN tuition as neutral with a verify-directly warning, not a penalty", () => {
    const target = baseProgramTarget({ tuitionType: "UNKNOWN", tuitionAmount: null, tuitionCurrency: null });
    const result = scoreTarget(baseProfile({ budgetMaxPerYear: 10000, budgetCurrency: "EUR" }), target, true);

    const budget = result.factorScores.find((f) => f.factor === "BUDGET_COMPATIBILITY")!;
    expect(budget.score).toBe(60);
    expect(result.warnings.some((w) => /verify/i.test(w))).toBe(true);
  });

  it("does not penalize budget when the student hasn't set one and tuition is FREE", () => {
    const target = baseProgramTarget({ tuitionType: "FREE" });
    const result = scoreTarget(baseProfile({ budgetMaxPerYear: null }), target, true);

    const budget = result.factorScores.find((f) => f.factor === "BUDGET_COMPATIBILITY")!;
    expect(budget.score).toBe(100);
  });
});
