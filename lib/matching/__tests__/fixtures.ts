import type { MatchTarget, StudentProfileForMatching } from "../types";

export function baseProfile(overrides: Partial<StudentProfileForMatching> = {}): StudentProfileForMatching {
  return {
    nationality: null,
    currentEducationLevel: "BACHELOR",
    currentGpa: null,
    gpaScale: 4,
    fieldOfStudy: null,
    desiredDegreeLevel: "MASTER",
    desiredFields: ["Computer Science"],
    preferredCountries: [],
    budgetMaxPerYear: null,
    budgetCurrency: null,
    workExperienceMonths: null,
    financialNeedSelfReported: null,
    languageProficiencies: [],
    ...overrides,
  };
}

export function baseProgramTarget(overrides: Partial<MatchTarget> = {}): MatchTarget {
  return {
    degreeLevel: "MASTER",
    fieldCategory: "STEM",
    countries: ["DE"],
    tuitionType: "FREE",
    tuitionAmount: null,
    tuitionCurrency: null,
    requirements: [],
    eligibility: [],
    ...overrides,
  };
}

export function baseScholarshipTarget(overrides: Partial<MatchTarget> = {}): MatchTarget {
  return {
    degreeLevel: null,
    fieldCategory: null,
    countries: [],
    tuitionType: null,
    tuitionAmount: null,
    tuitionCurrency: null,
    requirements: [],
    eligibility: [],
    ...overrides,
  };
}
