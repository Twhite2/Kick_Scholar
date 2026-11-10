import { describe, it, expect } from "vitest";
import { scholarshipCriteria } from "../factors/scholarshipCriteria";
import type { MatchTarget, StudentProfileForMatching } from "../types";

const profile: StudentProfileForMatching = {
  nationality: "NG",
  currentEducationLevel: "BACHELOR",
  currentGpa: 3.5,
  gpaScale: 4,
  fieldOfStudy: "Computer Science",
  desiredDegreeLevel: "MASTER",
  desiredFields: ["STEM"],
  preferredCountries: ["DE"],
  budgetMaxPerYear: 10000,
  budgetCurrency: "EUR",
  workExperienceMonths: 24,
  financialNeedSelfReported: true,
  languageProficiencies: [],
};

const programTarget = (
  linkedScholarships: MatchTarget["linkedScholarships"],
): MatchTarget => ({
  degreeLevel: "MASTER",
  fieldCategory: "STEM",
  countries: ["DE"],
  tuitionType: "FREE",
  tuitionAmount: null,
  tuitionCurrency: null,
  requirements: [],
  // A programme never carries eligibility rules of its own.
  eligibility: [],
  linkedScholarships,
});

describe("scholarshipCriteria on a programme", () => {
  it("scores the share of linked scholarships the student qualifies for", () => {
    const result = scholarshipCriteria(profile, programTarget({ total: 8, eligible: 6 }));
    expect(result.score).toBe(75);
    expect(result.explanation).toContain("6 of 8");
  });

  it("says so plainly when none of the linked scholarships match", () => {
    const result = scholarshipCriteria(profile, programTarget({ total: 5, eligible: 0 }));
    expect(result.score).toBe(0);
    expect(result.explanation).toContain("None of the 5");
  });

  it("distinguishes 'no scholarships linked' from 'not applicable'", () => {
    // These read the same to a user but mean different things: one is a gap in
    // the catalogue, the other is a factor that cannot apply at all.
    expect(scholarshipCriteria(profile, programTarget({ total: 0, eligible: 0 })).explanation).toContain(
      "No scholarships are linked",
    );
    expect(scholarshipCriteria(profile, programTarget(null)).explanation).toBe("Not applicable.");
  });

  it("leaves the score unassessed rather than zero when nothing is linked", () => {
    // Zero would drag the weighted average down for a programme whose only
    // fault is that our catalogue has not linked it yet.
    expect(scholarshipCriteria(profile, programTarget({ total: 0, eligible: 0 })).score).toBeNull();
    expect(scholarshipCriteria(profile, programTarget(null)).score).toBeNull();
  });
});

describe("scholarshipCriteria on a scholarship", () => {
  const scholarshipTarget = (
    eligibility: MatchTarget["eligibility"],
  ): MatchTarget => ({
    degreeLevel: null,
    fieldCategory: null,
    countries: ["DE"],
    tuitionType: null,
    tuitionAmount: null,
    tuitionCurrency: null,
    requirements: [],
    eligibility,
    linkedScholarships: null,
  });

  it("hard-fails a nationality the scholarship excludes", () => {
    const result = scholarshipCriteria(
      profile,
      scholarshipTarget([
        {
          criterionType: "NATIONALITY",
          operator: "IN_LIST",
          valueList: ["DE", "FR"],
          numericValue: null,
          textValue: null,
          verified: true,
        },
      ]),
    );
    expect(result.hardFail).toBe(true);
    expect(result.score).toBe(0);
  });

  it("passes a nationality the scholarship includes", () => {
    const result = scholarshipCriteria(
      profile,
      scholarshipTarget([
        {
          criterionType: "NATIONALITY",
          operator: "IN_LIST",
          valueList: ["NG", "GH"],
          numericValue: null,
          textValue: null,
          verified: true,
        },
      ]),
    );
    expect(result.hardFail).toBeUndefined();
    expect(result.score).toBe(100);
  });
});
