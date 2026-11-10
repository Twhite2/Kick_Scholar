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

/**
 * Bump whenever scoring semantics change, so stored Match.engineVersion says
 * which rules produced a score and old rows can be told apart from new ones.
 *
 * 2026.09.1 — work-experience requirements are converted from their stated
 * unit into months before comparison. Previously every value was read as
 * months, so "5 years" was compared as 5 and "18 weeks" as 18.
 *
 * 2026.09.2 — SCHOLARSHIP_ELIGIBILITY now scores on programmes, as the share
 * of linked scholarships the student qualifies for. It previously returned
 * "Not applicable" for every programme, since a programme has no eligibility
 * rules of its own.
 */
export const ENGINE_VERSION = "2026.09.2";
