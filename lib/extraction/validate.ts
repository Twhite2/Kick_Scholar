import type { ExtractedProgram, ExtractedRequirement } from "./schemas";

export interface ValidationIssue {
  path: string;
  message: string;
}

/**
 * Business-rule validation beyond what zod's shape-checking can express —
 * these are the "does this actually make sense" checks, applied after
 * ExtractionFileSchema has already confirmed the JSON is well-formed.
 */
export function validateProgram(program: ExtractedProgram): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (program.tuitionType === "PAID" && program.tuitionAmount === null) {
    issues.push({
      path: "tuitionType",
      message: 'tuitionType is PAID but tuitionAmount is null — use "UNKNOWN" if the amount was not stated',
    });
  }
  if (program.tuitionType !== "PAID" && program.tuitionAmount !== null) {
    issues.push({
      path: "tuitionAmount",
      message: `tuitionAmount is set but tuitionType is ${program.tuitionType}, not PAID`,
    });
  }
  if (program.tuitionAmount !== null && program.tuitionCurrency === null) {
    issues.push({ path: "tuitionCurrency", message: "tuitionAmount is set but tuitionCurrency is missing" });
  }

  for (const [i, req] of program.requirements.entries()) {
    issues.push(...validateRequirement(req).map((issue) => ({ ...issue, path: `requirements[${i}].${issue.path}` })));
  }

  return issues;
}

export function validateRequirement(req: ExtractedRequirement): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (req.operator === "BOOLEAN_TRUE" && req.value !== "true") {
    issues.push({ path: "value", message: 'operator is BOOLEAN_TRUE but value is not the string "true"' });
  }
  if (["GTE", "LTE", "GT", "LT"].includes(req.operator) && Number.isNaN(Number(req.value))) {
    issues.push({ path: "value", message: `operator ${req.operator} requires a numeric value, got "${req.value}"` });
  }
  if (req.requirementType === "LANGUAGE_TEST" && !req.testName) {
    issues.push({ path: "testName", message: "LANGUAGE_TEST requirements should name the test (e.g. IELTS, TOEFL)" });
  }

  return issues;
}
