import type { DegreeLevel, FieldCategory, RequirementOperator } from "../generated/prisma/enums";

export type FactorKey =
  | "ACADEMIC_COMPATIBILITY"
  | "DEGREE_COMPATIBILITY"
  | "FIELD_COMPATIBILITY"
  | "COUNTRY_PREFERENCE"
  | "LANGUAGE_COMPATIBILITY"
  | "BUDGET_COMPATIBILITY"
  | "SCHOLARSHIP_ELIGIBILITY"
  | "WORK_EXPERIENCE";

export interface FactorScore {
  factor: FactorKey;
  /** 0-100, or null when there isn't enough published/profile data to assess this factor. */
  score: number | null;
  weight: number;
  explanation: string;
  /** True for an explicit, stated disqualification (e.g. nationality excluded) — classify.ts always surfaces this as MISSING_REQUIREMENT regardless of the aggregate score. */
  hardFail?: boolean;
  /** True when this factor found a requirement the student doesn't yet meet purely for lack of profile data (e.g. no IELTS score on file) — feeds missingRequirements/recommendedActions. */
  missingProfileData?: string;
}

export interface StudentLanguageProficiencyLike {
  testName: string;
  score: number | null;
  cefrLevel: string | null;
}

export interface StudentProfileForMatching {
  nationality: string | null;
  currentEducationLevel: DegreeLevel | null;
  currentGpa: number | null;
  gpaScale: number | null;
  fieldOfStudy: string | null;
  desiredDegreeLevel: DegreeLevel | null;
  desiredFields: string[];
  preferredCountries: string[];
  budgetMaxPerYear: number | null;
  budgetCurrency: string | null;
  workExperienceMonths: number | null;
  financialNeedSelfReported: boolean | null;
  languageProficiencies: StudentLanguageProficiencyLike[];
}

/** A ProgramRequirement or ScholarshipEligibility row, in whichever shape the factor needs. */
export interface RequirementLike {
  requirementType:
    | "LANGUAGE_TEST"
    | "MIN_GPA"
    | "DEGREE_PREREQUISITE"
    | "WORK_EXPERIENCE"
    | "STANDARDIZED_TEST"
    | "PORTFOLIO"
    | "INTERVIEW"
    | "OTHER";
  testName: string | null;
  operator: RequirementOperator;
  value: string;
  unit: string | null;
  verified: boolean;
}

export interface EligibilityLike {
  criterionType:
    | "NATIONALITY"
    | "DEGREE_LEVEL"
    | "FIELD_OF_STUDY"
    | "MIN_GPA"
    | "MAX_AGE"
    | "COUNTRY_OF_STUDY"
    | "UNIVERSITY"
    | "FINANCIAL_NEED"
    | "ACADEMIC_EXCELLENCE"
    | "WORK_EXPERIENCE"
    | "LANGUAGE"
    | "OTHER";
  operator: RequirementOperator;
  valueList: string[];
  numericValue: number | null;
  textValue: string | null;
  verified: boolean;
}

/** Normalized shape both a Program and a Scholarship are reduced to before scoring. */
export interface MatchTarget {
  degreeLevel: DegreeLevel | null;
  fieldCategory: FieldCategory | null;
  countries: string[]; // empty = no country restriction stated
  tuitionType: "FREE" | "PAID" | "UNKNOWN" | "VARIES" | null;
  tuitionAmount: number | null;
  tuitionCurrency: string | null;
  requirements: RequirementLike[];
  eligibility: EligibilityLike[];
}

export interface MatchResult {
  score: number;
  matchStrength: "STRONG_MATCH" | "LIKELY_ELIGIBLE" | "POTENTIAL_MATCH" | "MISSING_REQUIREMENT" | "NEEDS_VERIFICATION";
  factorScores: FactorScore[];
  strengths: string[];
  missingRequirements: string[];
  warnings: string[];
  recommendedActions: string[];
  engineVersion: string;
}
