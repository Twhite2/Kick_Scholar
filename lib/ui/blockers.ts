import type { FactorKey, FactorScore } from "@/lib/matching/types";

/**
 * Reads the engine's factor scores as the student-facing blocker taxonomy
 * used by the unlock card, "One requirement away" and next steps
 * (docs/ui-remodel.md §14.4).
 *
 * The scores are the engine's own (see lib/matching/factors/*): this only
 * names what a given score already means. Nothing is re-scored here.
 */

export type BlockerKind =
  | "ENGLISH_TEST_MISSING"
  | "ENGLISH_SCORE_LOW"
  | "LANGUAGE_TEST_MISSING"
  | "LANGUAGE_SCORE_LOW"
  | "CGPA_BELOW_MIN"
  | "BUDGET_OVER"
  | "WORK_EXPERIENCE_SHORT"
  | "WORK_EXPERIENCE_MISSING"
  | "DEGREE_NOT_ELIGIBLE"
  | "NOT_ELIGIBLE";

/** Missing profile details the engine could not assess without. */
export type ActionKind =
  | "ENGLISH_TEST_MISSING"
  | "LANGUAGE_TEST_MISSING"
  | "CGPA_MISSING"
  | "GPA_SCALE_MISSING"
  | "BUDGET_MISSING"
  | "WORK_EXPERIENCE_MISSING"
  | "EDUCATION_LEVEL_MISSING"
  | "FIELDS_MISSING";

const ENGLISH = /ielts|toefl|\bpte\b|cambridge|\b(cae|fce|cpe)\b|duolingo|english/i;

export interface Blocker {
  kind: BlockerKind;
  factor: FactorKey;
  explanation: string;
  /** False for things a student cannot change quickly (nationality, grades already earned). */
  fixable: boolean;
}

/** A requirement the student does not currently meet, or null. */
export function blockerOf(f: FactorScore): Blocker | null {
  const base = { factor: f.factor, explanation: f.explanation };
  if (f.hardFail) {
    return f.factor === "DEGREE_COMPATIBILITY"
      ? { ...base, kind: "DEGREE_NOT_ELIGIBLE", fixable: false }
      : { ...base, kind: "NOT_ELIGIBLE", fixable: false };
  }
  switch (f.factor) {
    case "LANGUAGE_COMPATIBILITY": {
      const english = ENGLISH.test(`${f.missingProfileData ?? ""} ${f.explanation}`);
      if (f.score === 0 && f.missingProfileData) {
        return { ...base, kind: english ? "ENGLISH_TEST_MISSING" : "LANGUAGE_TEST_MISSING", fixable: true };
      }
      if (f.score !== null && f.score < 50) {
        return { ...base, kind: english ? "ENGLISH_SCORE_LOW" : "LANGUAGE_SCORE_LOW", fixable: true };
      }
      return null;
    }
    case "ACADEMIC_COMPATIBILITY":
      return f.score !== null && f.score < 50 ? { ...base, kind: "CGPA_BELOW_MIN", fixable: false } : null;
    case "BUDGET_COMPATIBILITY":
      return f.score !== null && f.score < 50 ? { ...base, kind: "BUDGET_OVER", fixable: true } : null;
    case "WORK_EXPERIENCE":
      if (f.score === 0 && f.missingProfileData) return { ...base, kind: "WORK_EXPERIENCE_MISSING", fixable: true };
      return f.score !== null && f.score < 50 ? { ...base, kind: "WORK_EXPERIENCE_SHORT", fixable: true } : null;
    default:
      // Field, degree interest and country are preferences, not requirements.
      return null;
  }
}

export function blockersOf(factorScores: FactorScore[]): Blocker[] {
  return factorScores.map(blockerOf).filter((b): b is Blocker => b !== null);
}

/** A profile detail whose absence left a factor unassessed or failing. */
export function actionOf(f: FactorScore): ActionKind | null {
  if (!f.missingProfileData) return null;
  switch (f.factor) {
    case "LANGUAGE_COMPATIBILITY":
      return ENGLISH.test(`${f.missingProfileData} ${f.explanation}`) ? "ENGLISH_TEST_MISSING" : "LANGUAGE_TEST_MISSING";
    case "ACADEMIC_COMPATIBILITY":
      return /scale/i.test(f.missingProfileData) ? "GPA_SCALE_MISSING" : "CGPA_MISSING";
    case "BUDGET_COMPATIBILITY":
      return "BUDGET_MISSING";
    case "WORK_EXPERIENCE":
      return "WORK_EXPERIENCE_MISSING";
    case "DEGREE_COMPATIBILITY":
      return "EDUCATION_LEVEL_MISSING";
    case "FIELD_COMPATIBILITY":
      return "FIELDS_MISSING";
    default:
      return null;
  }
}

export interface UnlockCopy {
  title: string;
  body: string;
  primary: { label: string; href: string };
}

const PLURAL = (n: number, one: string, many: string) => `${n.toLocaleString("en-GB")} ${n === 1 ? one : many}`;

/**
 * The unlock card for the student's biggest fixable gap (§9.1.2, §14.4).
 * `programmes` and `scholarships` are how many of each this gap affects.
 * Returns null for gaps that are not shown as unlocks.
 */
export function unlockCopy(
  kind: ActionKind | BlockerKind | "PREFERENCES_MISSING",
  counts: { programmes: number; scholarships: number },
): UnlockCopy | null {
  const { programmes, scholarships } = counts;
  const all = programmes + scholarships;
  switch (kind) {
    case "ENGLISH_TEST_MISSING":
      if (programmes === 0) return null;
      return {
        title: `${PLURAL(programmes, "more programme opens", "more programmes open")} up when you add an English test score`,
        body: "Add your IELTS or TOEFL result. Some programmes accept a letter from your university confirming your degree was taught in English instead.",
        primary: { label: "Add test score", href: "/profile#language" },
      };
    case "ENGLISH_SCORE_LOW":
      if (programmes === 0) return null;
      return {
        title: `${PLURAL(programmes, "programme asks", "programmes ask")} for a higher English score than yours`,
        body: "If you have resat the test or have a newer result, add it to your profile.",
        primary: { label: "Update test score", href: "/profile#language" },
      };
    case "LANGUAGE_TEST_MISSING":
      if (all === 0) return null;
      return {
        title: `${PLURAL(all, "opportunity needs", "opportunities need")} a language test you haven't added`,
        body: "Add any language certificates you hold, for example TestDaF, DSH or Goethe.",
        primary: { label: "Add test score", href: "/profile#language" },
      };
    case "CGPA_MISSING":
      if (all === 0) return null;
      return {
        title: `Add your CGPA to see ${PLURAL(all, "more match", "more matches")}`,
        body: "Programmes that publish a minimum grade can't be checked until your CGPA is on your profile.",
        primary: { label: "Add CGPA", href: "/profile#academic" },
      };
    case "GPA_SCALE_MISSING":
      if (all === 0) return null;
      return {
        title: `Add your grading scale to check ${PLURAL(all, "more match", "more matches")}`,
        body: "Some universities grade on a different scale. Tell us yours and we convert your CGPA before comparing.",
        primary: { label: "Add grading scale", href: "/profile#academic" },
      };
    case "BUDGET_MISSING":
      if (programmes === 0) return null;
      return {
        title: `Add your budget to check fees on ${PLURAL(programmes, "programme", "programmes")}`,
        body: "We compare each programme's published tuition with what you can spend in a year.",
        primary: { label: "Add budget", href: "/profile#preferences" },
      };
    case "BUDGET_OVER":
      if (programmes === 0) return null;
      // The engine compares tuition with the stated budget (it has no living
      // cost data), so the fix offered is tuition funding.
      return {
        title: `${PLURAL(programmes, "programme charges", "programmes charge")} more than your budget`,
        body: "Scholarships that cover tuition can close the gap. Check which ones you qualify for.",
        primary: { label: "Find tuition funding", href: "/scholarships?coverage=FULL_TUITION" },
      };
    case "WORK_EXPERIENCE_SHORT":
      if (scholarships === 0) return null;
      return {
        title: `${PLURAL(scholarships, "scholarship needs", "scholarships need")} more work experience`,
        body: "Count internships, part-time jobs and national service if the scholarship accepts them.",
        primary: { label: "Update experience", href: "/profile#experience" },
      };
    case "WORK_EXPERIENCE_MISSING":
      if (all === 0) return null;
      return {
        title: `${PLURAL(all, "opportunity asks", "opportunities ask")} for work experience`,
        body: "Add how many months you have worked, including internships and national service.",
        primary: { label: "Update experience", href: "/profile#experience" },
      };
    case "EDUCATION_LEVEL_MISSING":
      if (all === 0) return null;
      return {
        title: `Add your current education level to check ${PLURAL(all, "more match", "more matches")}`,
        body: "Degree programmes have entry levels. We check yours against each one.",
        primary: { label: "Add education level", href: "/profile#academic" },
      };
    case "FIELDS_MISSING":
      return {
        title: "Add the fields you want to study to sharpen your matches",
        body: "Without them, every subject counts as an equal fit.",
        primary: { label: "Add fields", href: "/profile#preferences" },
      };
    case "PREFERENCES_MISSING":
      return {
        title: "Add preferred countries to sharpen your matches",
        body: "We rank programmes in the countries you choose above the rest.",
        primary: { label: "Add countries", href: "/profile#preferences" },
      };
    // Not shown as unlocks: nothing to fix quickly, or not fixable at all.
    case "CGPA_BELOW_MIN":
    case "LANGUAGE_SCORE_LOW":
    case "DEGREE_NOT_ELIGIBLE":
    case "NOT_ELIGIBLE":
      return null;
  }
}

/** The action button on "One requirement away" cards and next steps. */
export function blockerAction(kind: BlockerKind): { label: string; href: string } | null {
  switch (kind) {
    case "ENGLISH_TEST_MISSING":
    case "LANGUAGE_TEST_MISSING":
      return { label: "Add test score", href: "/profile#language" };
    case "ENGLISH_SCORE_LOW":
    case "LANGUAGE_SCORE_LOW":
      return { label: "Update test score", href: "/profile#language" };
    case "BUDGET_OVER":
      return { label: "Find tuition funding", href: "/scholarships?coverage=FULL_TUITION" };
    case "WORK_EXPERIENCE_SHORT":
    case "WORK_EXPERIENCE_MISSING":
      return { label: "Update experience", href: "/profile#experience" };
    case "CGPA_BELOW_MIN":
    case "DEGREE_NOT_ELIGIBLE":
    case "NOT_ELIGIBLE":
      return null;
  }
}
