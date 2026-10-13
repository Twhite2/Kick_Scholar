/**
 * Puts a student's grade on the same scale as a requirement before the two
 * are compared.
 *
 * Without this, a US student with 3.8/4.0 was compared directly against a
 * German "LTE 2.7" (1.0 best, 4.0 pass) and failed — and DAAD programmes are
 * most of the catalogue. Comparing raw numbers across scales is never right,
 * so every comparison goes through here.
 *
 * ASSUMPTION: the student's own grade is on an ascending scale (higher is
 * better) out of `gpaScale`. The profile has no field for "my grades are
 * German-style", so a student entering German grades would be misread.
 */

export type GradeScale = { kind: "german" } | { kind: "ascending"; max: number };

const GERMAN_UNIT = /german/i;

/**
 * Infers the scale a requirement is written on. The loader flips German-scale
 * MIN_GPA rows to LTE/LT and labels their unit, so either signal identifies
 * one. Ascending scales are inferred from the threshold itself: a minimum of
 * 3.0 is on a 4-point scale, 7.5 on a 10-point one, 75 on a percentage.
 */
export function requirementScale(operator: string, value: number, unit: string | null): GradeScale {
  if (unit && GERMAN_UNIT.test(unit)) return { kind: "german" };
  if ((operator === "LTE" || operator === "LT") && value >= 1 && value <= 4) return { kind: "german" };
  if (value <= 4) return { kind: "ascending", max: 4 };
  if (value <= 10) return { kind: "ascending", max: 10 };
  if (value <= 20) return { kind: "ascending", max: 20 };
  return { kind: "ascending", max: 100 };
}

/**
 * Minimum passing grade as a fraction of the maximum. Real pass marks vary by
 * country (40–60% is typical); half is the usual default when the
 * institution's own pass mark is unknown.
 */
const PASS_FRACTION = 0.5;

/**
 * Converts an ascending-scale grade to the German 1.0–4.0 scale with the
 * modified Bavarian formula — the conversion German universities and
 * uni-assist themselves use:
 *
 *   german = 1 + 3 * (max - grade) / (max - minPass)
 *
 * Grades below the pass mark land above 4.0, i.e. a fail. Clamped at 1.0
 * because nothing beats the best grade.
 */
export function toGermanScale(grade: number, scaleMax: number): number {
  const minPass = scaleMax * PASS_FRACTION;
  const german = 1 + (3 * (scaleMax - grade)) / (scaleMax - minPass);
  return Math.max(1, Math.round(german * 10) / 10);
}

/**
 * The student's grade expressed on `target`'s scale, or null when it can't
 * be converted honestly (no stated scale for the student's own grade).
 */
export function convertStudentGrade(
  gpa: number,
  gpaScale: number | null,
  target: GradeScale,
): number | null {
  if (target.kind === "german") {
    return gpaScale ? toGermanScale(gpa, gpaScale) : null;
  }
  // Without a stated scale, assume the student entered it on the same scale
  // the requirement uses — the pre-existing behaviour, and right for the
  // common 4.0 case.
  if (!gpaScale || gpaScale === target.max) return gpa;
  return Math.round((gpa / gpaScale) * target.max * 100) / 100;
}
