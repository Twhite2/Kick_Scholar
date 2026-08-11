import type { FactorKey } from "./types";

/**
 * Default factor weights (sum to 1.0). A factor with score=null is excluded
 * from both the numerator and denominator when aggregating — it is treated
 * as "not assessed," never as a penalty or a free pass.
 */
export const DEFAULT_WEIGHTS: Record<FactorKey, number> = {
  ACADEMIC_COMPATIBILITY: 0.2,
  FIELD_COMPATIBILITY: 0.2,
  LANGUAGE_COMPATIBILITY: 0.15,
  DEGREE_COMPATIBILITY: 0.15,
  COUNTRY_PREFERENCE: 0.1,
  BUDGET_COMPATIBILITY: 0.1,
  SCHOLARSHIP_ELIGIBILITY: 0.05,
  WORK_EXPERIENCE: 0.05,
};

export const ENGINE_VERSION = "2026.08.1";
