import type { MatchTarget, StudentProfileForMatching } from "./types";

// Structural (not Prisma-generated) input types — keeps this module and its
// tests independent of exact Prisma payload shapes, while still matching
// what a `program.findMany({ include: { requirements: true } })`-style
// query naturally returns.

interface ProgramWithRelations {
  degreeLevel: MatchTarget["degreeLevel"];
  fieldCategory: MatchTarget["fieldCategory"];
  tuitionType: MatchTarget["tuitionType"];
  tuitionAmount: number | { toNumber(): number } | null;
  tuitionCurrency: string | null;
  university: { country: string };
  requirements: Array<{
    requirementType: string;
    testName: string | null;
    operator: string;
    value: string;
    unit: string | null;
    verified: boolean;
  }>;
}

interface ScholarshipWithRelations {
  country: string | null;
  eligibility: Array<{
    criterionType: string;
    operator: string;
    valueList: string[];
    numericValue: number | null;
    textValue: string | null;
    verified: boolean;
  }>;
}

function toNumber(value: number | { toNumber(): number } | null): number | null {
  if (value === null) return null;
  return typeof value === "number" ? value : value.toNumber();
}

export function programToMatchTarget(program: ProgramWithRelations): MatchTarget {
  return {
    degreeLevel: program.degreeLevel,
    fieldCategory: program.fieldCategory,
    countries: [program.university.country],
    tuitionType: program.tuitionType,
    tuitionAmount: toNumber(program.tuitionAmount),
    tuitionCurrency: program.tuitionCurrency,
    requirements: program.requirements as MatchTarget["requirements"],
    eligibility: [],
  };
}

export function scholarshipToMatchTarget(scholarship: ScholarshipWithRelations): MatchTarget {
  return {
    degreeLevel: null,
    fieldCategory: null,
    countries: scholarship.country ? [scholarship.country] : [],
    tuitionType: null,
    tuitionAmount: null,
    tuitionCurrency: null,
    requirements: [],
    eligibility: scholarship.eligibility as MatchTarget["eligibility"],
  };
}

interface StudentProfileWithRelations {
  nationality: string | null;
  currentEducationLevel: StudentProfileForMatching["currentEducationLevel"];
  currentGpa: number | { toNumber(): number } | null;
  gpaScale: number | { toNumber(): number } | null;
  fieldOfStudy: string | null;
  desiredDegreeLevel: StudentProfileForMatching["desiredDegreeLevel"];
  desiredFields: string[];
  preferredCountries: string[];
  budgetMaxPerYear: number | { toNumber(): number } | null;
  budgetCurrency: string | null;
  workExperienceMonths: number | null;
  financialNeedSelfReported: boolean | null;
  languageProficiencies: Array<{ testName: string; score: number | { toNumber(): number } | null; cefrLevel: string | null }>;
}

export function studentProfileToMatchInput(profile: StudentProfileWithRelations): StudentProfileForMatching {
  return {
    nationality: profile.nationality,
    currentEducationLevel: profile.currentEducationLevel,
    currentGpa: toNumber(profile.currentGpa),
    gpaScale: toNumber(profile.gpaScale),
    fieldOfStudy: profile.fieldOfStudy,
    desiredDegreeLevel: profile.desiredDegreeLevel,
    desiredFields: profile.desiredFields,
    preferredCountries: profile.preferredCountries,
    budgetMaxPerYear: toNumber(profile.budgetMaxPerYear),
    budgetCurrency: profile.budgetCurrency,
    workExperienceMonths: profile.workExperienceMonths,
    financialNeedSelfReported: profile.financialNeedSelfReported,
    languageProficiencies: profile.languageProficiencies.map((p) => ({
      testName: p.testName,
      score: toNumber(p.score),
      cefrLevel: p.cefrLevel,
    })),
  };
}
