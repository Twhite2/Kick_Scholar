/**
 * Corrects the direction of German-scale grade requirements.
 *
 * German grades run 1.0 (best) to 4.0 (pass), so a page that says "an overall
 * grade of at least 2.7 (German grading system)" means the applicant's number
 * must be *no higher* than 2.7. The model copies that wording faithfully and
 * emits `GTE 2.7` — a correct quote attached to an inverted comparison.
 *
 * This is not a hallucination and the quote guard cannot catch it: the
 * sentence really is on the page. But stored as-is, the matching engine would
 * accept a 3.5 and reject a 1.5 for a programme demanding 2.7 or better, which
 * is the worst possible failure for a tool students use to decide where to
 * apply.
 *
 * Measured across the 1,422 loaded DAAD programmes: 200 MIN_GPA requirements,
 * of which 51 cite the German scale and needed flipping.
 */

/**
 * Detecting a German-scale grade is harder than matching one phrase. Real
 * wording from the crawled pages includes "German grading scheme", "German
 * scoring system", "German university grading system", "German marking
 * system", "a German GPA of at least 2.3", and — with no grading vocabulary at
 * all — "obtained in Germany or abroad with an overall grade of 2.0 or higher".
 *
 * A first attempt matched only "german (grading )?(system|scale|grade)" and
 * missed 13 of those, every one a real requirement that would have mis-scored
 * students. So detection now runs in two tiers, because the confidence differs:
 *
 *   Tier 1 (explicit): the text names a German grading system, however it
 *     phrases it. Any value in the German range is flipped.
 *   Tier 2 (implicit): the text only mentions Germany. Flipped solely when the
 *     threshold is 3.0 or better, where a US 4.0-scale reading is implausible
 *     — a "minimum GPA" of 2.3 on an ascending scale would admit almost
 *     nobody, while on the German scale it is an ordinary requirement.
 *
 * The 3.0–4.0 band is where an ascending-scale reading becomes plausible,
 * which is exactly why tier 2 stops at 3.0 rather than covering the range.
 */
const GERMAN_MENTION = /\b(german[a-z]*|germany|deutsch[a-z]*)\b/i;

/** "German" within a short distance of grading vocabulary, in either order. */
const GERMAN_GRADING_EXPLICIT =
  /german[a-z]*\W+(?:\w+\W+){0,2}(grad|mark|scor|scheme|scale|system|gpa|note)|(grade|grading|mark|marking|score|scoring|gpa)\b[^.]{0,40}\bgerman/i;

/** "1.0 is best" and friends state the inversion outright. */
const GERMAN_INVERSION_STATED = /\b1[.,]0\s+is\s+(the\s+)?best|lower\s+is\s+better/i;

/**
 * An explicitly different scale. When a page says "out of 100" or "on a 4.0
 * scale", believe it and leave the comparison alone — flipping there would
 * invent a failure rather than fix one.
 *
 * A bare "%" is deliberately NOT a signal here. It was at first, and it
 * silently suppressed a genuine "2.5 or better according to the German marking
 * system" because the same sentence offered an alternative route — "or be
 * ranked among the best 50% of your cohort". A percentage elsewhere in the
 * sentence says nothing about the scale of *this* threshold, and a
 * percentage-valued grade is already excluded by the numeric range check.
 */
const COMPETING_SCALE =
  /out of \d|\/\s*100\b|4[.,]0[- ]?(point[- ]?)?scale|scale of 4|\b100[- ]point/i;

/**
 * German grades only occupy 1.0–4.0 for a pass (5.0 is a fail). A "GPA" of 3.5
 * cited alongside the German scale is far more likely a 4.0-scale number that
 * merely mentions Germany, so the range check keeps this from firing on one.
 */
const GERMAN_MIN = 1.0;
const GERMAN_MAX = 4.0;

/** Above this, a "minimum" reads naturally on an ascending 4.0 scale. */
const IMPLICIT_MAX = 3.0;

const FLIP: Record<string, string> = { GTE: "LTE", GT: "LT" };

export interface GradeRequirementLike {
  requirementType: string;
  operator: string;
  value: string;
  unit?: string | null;
  sourceQuote: string;
}

export function isGermanScaleGrade(req: GradeRequirementLike): boolean {
  if (req.requirementType !== "MIN_GPA") return false;
  const numeric = Number(String(req.value).replace(",", "."));
  if (!Number.isFinite(numeric)) return false;
  if (numeric < GERMAN_MIN || numeric > GERMAN_MAX) return false;

  const text = `${req.unit ?? ""} ${req.sourceQuote}`;
  if (COMPETING_SCALE.test(text)) return false;

  if (GERMAN_GRADING_EXPLICIT.test(text) || GERMAN_INVERSION_STATED.test(text)) return true;
  return GERMAN_MENTION.test(text) && numeric <= IMPLICIT_MAX;
}

/**
 * Returns the requirement with its operator corrected, plus whether anything
 * changed. The quote is never touched — it stays exactly as the page wrote it,
 * so the audit trail still shows "at least 2.7" next to the LTE that actually
 * expresses it.
 */
export function normaliseGradeDirection<T extends GradeRequirementLike>(
  req: T,
): { requirement: T; corrected: boolean } {
  if (!isGermanScaleGrade(req)) return { requirement: req, corrected: false };
  const flipped = FLIP[req.operator];
  if (!flipped) return { requirement: req, corrected: false };
  return {
    requirement: {
      ...req,
      operator: flipped,
      // Make the inversion legible wherever the row is read back, rather than
      // silently changing the meaning of the stored comparison.
      unit: req.unit ?? "German scale (1.0 best – 4.0 pass)",
    },
    corrected: true,
  };
}

export function normaliseGradeDirections<T extends GradeRequirementLike>(
  requirements: readonly T[],
): { requirements: T[]; corrected: number } {
  let corrected = 0;
  const out = requirements.map((r) => {
    const res = normaliseGradeDirection(r);
    if (res.corrected) corrected += 1;
    return res.requirement;
  });
  return { requirements: out, corrected };
}
