import { z } from "zod";

// Structured extraction schemas. The core discipline enforced here — never
// hallucinate — is structural, not a matter of discipline alone:
//   - every record requires the sourceUrl it was read from
//   - every requirement/deadline/eligibility sub-fact requires a verbatim
//     sourceQuote — a fact with no supporting quote simply fails validation
//     and can't reach normalization/dedup/the database
//   - every optional field defaults to null, never a guessed value (e.g.
//     tuitionType has no numeric default — UNKNOWN is a first-class value)

export const DegreeLevelSchema = z.enum([
  "HIGH_SCHOOL",
  "BACHELOR",
  "MASTER",
  "PHD",
  "DIPLOMA",
  "CERTIFICATE",
  "OTHER",
]);

export const FieldCategorySchema = z.enum([
  "STEM",
  "BUSINESS",
  "HUMANITIES",
  "SOCIAL_SCIENCES",
  "ARTS",
  "HEALTH",
  "LAW",
  "EDUCATION",
  "OTHER",
]);

export const TuitionTypeSchema = z.enum(["FREE", "PAID", "UNKNOWN", "VARIES"]);
export const TuitionPeriodSchema = z.enum(["PER_SEMESTER", "PER_YEAR", "PER_PROGRAM", "UNKNOWN"]);

export const RequirementTypeSchema = z.enum([
  "LANGUAGE_TEST",
  "MIN_GPA",
  "DEGREE_PREREQUISITE",
  "WORK_EXPERIENCE",
  "STANDARDIZED_TEST",
  "PORTFOLIO",
  "INTERVIEW",
  "OTHER",
]);

export const RequirementOperatorSchema = z.enum([
  "GTE",
  "LTE",
  "GT",
  "LT",
  "EQ",
  "IN_LIST",
  "BOOLEAN_TRUE",
]);

export const DeadlineTypeSchema = z.enum([
  "APPLICATION",
  "DOCUMENT_SUBMISSION",
  "SCHOLARSHIP_APPLICATION",
  "DECISION_NOTIFICATION",
  "ENROLLMENT",
]);

export const ScholarshipCoverageTypeSchema = z.enum([
  "FULL_TUITION",
  "PARTIAL_TUITION",
  "STIPEND",
  "TRAVEL",
  "FULL_FUNDING",
  "UNKNOWN",
  "VARIES",
]);

export const EligibilityCriterionTypeSchema = z.enum([
  "NATIONALITY",
  "DEGREE_LEVEL",
  "FIELD_OF_STUDY",
  "MIN_GPA",
  "MAX_AGE",
  "COUNTRY_OF_STUDY",
  "UNIVERSITY",
  "FINANCIAL_NEED",
  "ACADEMIC_EXCELLENCE",
  "WORK_EXPERIENCE",
  "LANGUAGE",
  "OTHER",
]);

// --- Sub-facts: every one requires a verbatim quote from the source -------

export const ExtractedRequirementSchema = z.object({
  requirementType: RequirementTypeSchema,
  testName: z.string().nullable().default(null),
  operator: RequirementOperatorSchema,
  value: z.string(),
  unit: z.string().nullable().default(null),
  sourceQuote: z.string().min(1, "Every requirement needs a verbatim quote from the source"),
  // Overrides the parent record's sourceUrl for this one fact — set when a
  // sub-fact was read from a different page than the program/scholarship's
  // own canonical page (e.g. a shared "dates & deadlines" page).
  sourceUrl: z.url().nullable().default(null),
});

export const ExtractedDeadlineSchema = z.object({
  deadlineType: DeadlineTypeSchema,
  // Exactly one of date/dateText — a deadline with neither is not a fact.
  date: z.iso.datetime({ offset: true }).nullable().default(null),
  dateText: z.string().nullable().default(null),
  intake: z.string().nullable().default(null),
  sourceQuote: z.string().min(1, "Every deadline needs a verbatim quote from the source"),
  sourceUrl: z.url().nullable().default(null),
}).refine((d) => d.date !== null || d.dateText !== null, {
  message: "A deadline must have either a parsed date or a dateText fallback",
});

export const ExtractedEligibilitySchema = z.object({
  criterionType: EligibilityCriterionTypeSchema,
  operator: RequirementOperatorSchema,
  valueList: z.array(z.string()).default([]),
  numericValue: z.number().nullable().default(null),
  textValue: z.string().nullable().default(null),
  sourceQuote: z.string().min(1, "Every eligibility criterion needs a verbatim quote from the source"),
  sourceUrl: z.url().nullable().default(null),
});

// --- Top-level records ------------------------------------------------------

export const ExtractedUniversitySchema = z.object({
  name: z.string().min(1),
  country: z.string().length(2),
  city: z.string().min(1),
  website: z.url(),
  description: z.string().nullable().default(null),
  sourceUrl: z.url(),
  sourceQuote: z.string().min(1),
});

export const ExtractedProgramSchema = z.object({
  universityName: z.string().min(1),
  universityWebsite: z.url(),
  name: z.string().min(1),
  degreeLevel: DegreeLevelSchema,
  fieldOfStudy: z.string().min(1),
  fieldCategory: FieldCategorySchema,
  durationMonths: z.number().int().positive().nullable().default(null),
  instructionLanguages: z.array(z.string()).default([]),
  tuitionType: TuitionTypeSchema,
  tuitionAmount: z.number().nonnegative().nullable().default(null),
  tuitionCurrency: z.string().length(3).nullable().default(null),
  tuitionPeriod: TuitionPeriodSchema.nullable().default(null),
  intakes: z.array(z.string()).default([]),
  programUrl: z.url(),
  description: z.string().nullable().default(null),
  sourceUrl: z.url(),
  sourceQuote: z.string().min(1, "The core identity/degree-level claim needs a verbatim quote"),
  requirements: z.array(ExtractedRequirementSchema).default([]),
  deadlines: z.array(ExtractedDeadlineSchema).default([]),
});

export const ExtractedScholarshipSchema = z.object({
  name: z.string().min(1),
  providerName: z.string().min(1),
  providerType: z.enum([
    "UNIVERSITY",
    "NATIONAL_EDUCATION_PORTAL",
    "GOVERNMENT",
    "SCHOLARSHIP_PROVIDER",
    "SCHOLARSHIP_AGGREGATOR",
    "EDUCATION_DATABASE",
  ]),
  country: z.string().length(2).nullable().default(null),
  amount: z.number().nonnegative().nullable().default(null),
  amountCurrency: z.string().length(3).nullable().default(null),
  coverageType: ScholarshipCoverageTypeSchema,
  description: z.string().nullable().default(null),
  applicationUrl: z.url(),
  deadlineText: z.string().nullable().default(null),
  isRenewable: z.boolean().nullable().default(null),
  // Set when this record was found via a DISCOVERY-authority source rather
  // than read directly off an official page.
  discoveredFrom: z.string().nullable().default(null),
  discoveryUrl: z.url().nullable().default(null),
  officialSourceUrl: z.url().nullable().default(null),
  sourceUrl: z.url(),
  sourceQuote: z.string().min(1),
  eligibility: z.array(ExtractedEligibilitySchema).default([]),
  deadlines: z.array(ExtractedDeadlineSchema).default([]),
});

export type ExtractedUniversity = z.infer<typeof ExtractedUniversitySchema>;
export type ExtractedProgram = z.infer<typeof ExtractedProgramSchema>;
export type ExtractedScholarship = z.infer<typeof ExtractedScholarshipSchema>;
export type ExtractedRequirement = z.infer<typeof ExtractedRequirementSchema>;
export type ExtractedDeadline = z.infer<typeof ExtractedDeadlineSchema>;
export type ExtractedEligibility = z.infer<typeof ExtractedEligibilitySchema>;

// A single extraction file can contain any mix of these — a university page
// might yield a University plus several Programs, a scholarship post yields
// one Scholarship.
export const ExtractionFileSchema = z.object({
  sourceId: z.string().min(1),
  sourceDocumentId: z.string().min(1),
  extractedBy: z.enum(["manual", "claude-api"]).default("manual"),
  extractedAt: z.iso.datetime({ offset: true }),
  universities: z.array(ExtractedUniversitySchema).default([]),
  programs: z.array(ExtractedProgramSchema).default([]),
  scholarships: z.array(ExtractedScholarshipSchema).default([]),
});

export type ExtractionFile = z.infer<typeof ExtractionFileSchema>;
