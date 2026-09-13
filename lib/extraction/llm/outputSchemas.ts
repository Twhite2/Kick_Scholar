import { z } from "zod";

/**
 * A flat mirror of the extraction schema, shaped for Structured Outputs.
 *
 * `ExtractionFileSchema` itself cannot be handed to a structured-output
 * converter, for three concrete reasons:
 *   1. `ExtractedDeadlineSchema` uses `.refine()` — a runtime predicate with
 *      no JSON Schema representation.
 *   2. Nearly every field has `.default()`, which would *hide* missing model
 *      output behind a default instead of surfacing it.
 *   3. `z.url()` / `z.iso.datetime()` map to string formats the API may not
 *      enforce, so validating them here would be a false guarantee.
 *
 * So this mirror is explicit and permissive: every field nullable, no
 * defaults, no refinements, URLs and dates as plain strings. The real
 * `ExtractionFileSchema` then re-validates the result, which is where the
 * refinements and quote minimums are actually enforced.
 *
 * The `.describe()` calls are load-bearing — they are the prompt. Keeping the
 * instruction next to the field it governs stops the two drifting apart.
 */

const QUOTE = "The VERBATIM sentence from the page stating this. Copy it exactly, character for character. Never paraphrase, summarise or reconstruct it.";

export const LlmEligibilitySchema = z.object({
  criterionType: z
    .enum([
      "NATIONALITY", "DEGREE_LEVEL", "FIELD_OF_STUDY", "MIN_GPA", "MAX_AGE",
      "COUNTRY_OF_STUDY", "UNIVERSITY", "FINANCIAL_NEED", "ACADEMIC_EXCELLENCE",
      "WORK_EXPERIENCE", "LANGUAGE", "OTHER",
    ])
    .describe("Which kind of eligibility rule this is."),
  operator: z
    .enum(["GTE", "LTE", "GT", "LT", "EQ", "IN_LIST", "BOOLEAN_TRUE"])
    .describe(
      "Pick by criterionType, not by feel. NATIONALITY, DEGREE_LEVEL, FIELD_OF_STUDY, COUNTRY_OF_STUDY and UNIVERSITY are ALWAYS IN_LIST with valueList filled. MAX_AGE uses LT or LTE with numericValue. MIN_GPA and WORK_EXPERIENCE use GTE with numericValue. FINANCIAL_NEED, ACADEMIC_EXCELLENCE and LANGUAGE with no score use BOOLEAN_TRUE.",
    ),
  valueList: z
    .array(z.string())
    .describe(
      "REQUIRED whenever operator is IN_LIST — an IN_LIST rule with an empty valueList is useless and will be discarded. For DEGREE_LEVEL use exactly these tokens: HIGH_SCHOOL, BACHELOR, MASTER, PHD, DIPLOMA, CERTIFICATE, OTHER — e.g. 'graduates, doctoral candidates and post-doctoral researchers' means [\"BACHELOR\",\"MASTER\",\"PHD\"]. For NATIONALITY list the country names exactly as the page writes them. Empty array for non-IN_LIST operators.",
    ),
  numericValue: z
    .number()
    .nullable()
    .describe("ONLY for GTE/LTE/GT/LT — the numeric threshold (e.g. 40 for a max age, 3.0 for a GPA, 24 for months of experience). MUST be null for IN_LIST and BOOLEAN_TRUE."),
  textValue: z.string().nullable().describe("Short free-text detail where no enum or number fits. Null otherwise."),
  sourceQuote: z.string().describe(QUOTE),
});

export const LlmRequirementSchema = z.object({
  requirementType: z
    .enum([
      "LANGUAGE_TEST", "MIN_GPA", "DEGREE_PREREQUISITE", "WORK_EXPERIENCE",
      "STANDARDIZED_TEST", "PORTFOLIO", "INTERVIEW", "OTHER",
    ])
    .describe("Which kind of admission requirement this is."),
  testName: z.string().nullable().describe("Test name for LANGUAGE_TEST/STANDARDIZED_TEST (e.g. IELTS, TOEFL, GRE). Null otherwise."),
  operator: z
    .enum(["GTE", "LTE", "GT", "LT", "EQ", "IN_LIST", "BOOLEAN_TRUE"])
    .describe("Comparison operator. Use BOOLEAN_TRUE with value 'true' for a requirement with no threshold."),
  value: z.string().describe("The required value AS A STRING (e.g. '6.5', '24', 'true')."),
  unit: z.string().nullable().describe("Unit for the value where relevant (e.g. 'months'). Null otherwise."),
  sourceQuote: z.string().describe(QUOTE),
});

export const LlmApplicabilitySchema = z.object({
  countries: z.array(z.string()).describe("ISO 3166-1 alpha-2 codes of countries where the funding may be USED. Empty if not stated."),
  degreeLevels: z
    .array(z.enum(["HIGH_SCHOOL", "BACHELOR", "MASTER", "PHD", "DIPLOMA", "CERTIFICATE", "OTHER"]))
    .describe("Degree levels the funding covers. Empty if not stated."),
  fieldCategories: z
    .array(z.enum(["STEM", "BUSINESS", "HUMANITIES", "SOCIAL_SCIENCES", "ARTS", "HEALTH", "LAW", "EDUCATION", "OTHER"]))
    .describe("Broad subject areas the funding covers. Empty if not stated."),
  institutionTypes: z
    .array(z.enum(["PUBLIC", "PRIVATE", "STATE_RECOGNISED", "ANY"]))
    .describe("Kinds of institution the funding may be used at, e.g. 'state or state-recognised universities' -> STATE_RECOGNISED. Empty if not stated."),
  sourceQuote: z.string().describe(QUOTE),
});

export const LlmScholarshipFieldsSchema = z.object({
  eligibility: z
    .array(LlmEligibilitySchema)
    .describe("Every eligibility rule the page states. Empty array if none are stated — do not invent any."),
  applicability: z
    .array(LlmApplicabilitySchema)
    .describe(
      "Where the funding may be USED — this drives which universities the scholarship can be matched to, so it matters. Most scholarships name no specific university and instead state a rule: 'state or state-recognised universities in Germany' -> countries [\"DE\"], institutionTypes [\"STATE_RECOGNISED\"]; 'for a Master's in Germany' -> countries [\"DE\"], degreeLevels [\"MASTER\"]. Emit ONE object capturing the rule when the page states where or at what level the funding is used. Empty array ONLY if the page genuinely says nothing about where it can be used.",
    ),
  coverageType: z
    .enum(["FULL_TUITION", "PARTIAL_TUITION", "STIPEND", "TRAVEL", "FULL_FUNDING", "UNKNOWN", "VARIES"])
    .describe("What the award covers. Use UNKNOWN when the page does not say — UNKNOWN is a real answer, never a guess."),
});

export const LlmProgramFieldsSchema = z.object({
  requirements: z
    .array(LlmRequirementSchema)
    .describe("Every admission requirement the page states. Empty array if none — do not invent any."),
  fieldCategory: z
    .enum(["STEM", "BUSINESS", "HUMANITIES", "SOCIAL_SCIENCES", "ARTS", "HEALTH", "LAW", "EDUCATION", "OTHER"])
    .describe("Broad subject area of this programme, judged from its title and description."),
});

export type LlmScholarshipFields = z.infer<typeof LlmScholarshipFieldsSchema>;
export type LlmProgramFields = z.infer<typeof LlmProgramFieldsSchema>;
