import type { Blocker } from "./blockers";
import { blockerAction } from "./blockers";
import { formatDate } from "./format";

/**
 * "Your next steps" on detail pages, and the checklist seeded when a student
 * tracks an application (docs/ui-remodel.md §10.5). The two are the same
 * list, so ticking a step on the page ticks the document in My plan.
 *
 * The schema has no "document" requirement type, so documents are read from
 * requirement types that are evidenced by one: a language test by its result,
 * a grade by transcripts, work experience by a CV, a portfolio by itself.
 */

export interface NextStep {
  label: string;
  note?: string;
  action?: { label: string; href: string };
}

export interface RequirementLike {
  /** RequirementType for programmes, EligibilityCriterionType for scholarships. */
  type: string;
  testName?: string | null;
}

const BLOCKER_STEP: Partial<Record<Blocker["kind"], string>> = {
  ENGLISH_TEST_MISSING: "Add your English test score",
  LANGUAGE_TEST_MISSING: "Add your language test score",
  ENGLISH_SCORE_LOW: "Reach the required English score",
  LANGUAGE_SCORE_LOW: "Reach the required language score",
  CGPA_BELOW_MIN: "Ask the university whether your grades can be considered",
  BUDGET_OVER: "Find funding to cover the tuition",
  WORK_EXPERIENCE_SHORT: "Check you have enough work experience",
  WORK_EXPERIENCE_MISSING: "Add your work experience",
};

function documentFor(r: RequirementLike): string | null {
  const test = r.testName?.trim();
  switch (r.type) {
    case "LANGUAGE_TEST":
    case "LANGUAGE":
      return test ? `${test} result` : "language test result";
    case "STANDARDIZED_TEST":
      return test ? `${test} score report` : "test score report";
    case "PORTFOLIO":
      return "portfolio";
    case "DEGREE_PREREQUISITE":
    case "MIN_GPA":
    case "ACADEMIC_EXCELLENCE":
      return "degree certificate and transcripts";
    case "WORK_EXPERIENCE":
      return "CV";
    case "FINANCIAL_NEED":
      return "proof of financial need";
    default:
      return null;
  }
}

/** Collapse "IELTS Academic result" and "IELTS result" into one document. */
function documentKey(doc: string): string {
  const family = doc.match(/\b(IELTS|TOEFL|PTE|Duolingo|Cambridge|TestDaF|DSH|Goethe|GRE|GMAT|TestAS)\b/i)?.[1];
  return (family ?? doc).toLowerCase();
}

export function deriveNextSteps(input: {
  kind: "PROGRAM" | "SCHOLARSHIP";
  blockers: Blocker[];
  requirements: RequirementLike[];
  deadline: Date | string | null;
  now?: Date;
}): NextStep[] {
  const steps: NextStep[] = [];
  const seen = new Set<string>();
  const push = (step: NextStep) => {
    const key = step.label.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    steps.push(step);
  };

  for (const b of input.blockers) {
    const label = BLOCKER_STEP[b.kind];
    if (!label) continue;
    push({ label, action: blockerAction(b.kind) ?? undefined });
  }

  const docs = new Set<string>();
  for (const r of input.requirements) {
    const doc = documentFor(r);
    if (!doc) continue;
    const key = documentKey(doc);
    if (docs.has(key)) continue;
    docs.add(key);
    push({ label: `Prepare your ${doc}` });
  }

  const where = input.kind === "PROGRAM" ? "on the university site" : "on the provider's site";
  push(
    input.deadline
      ? { label: `Submit ${where} by ${formatDate(input.deadline, input.now)}` }
      : { label: "Submit on the official site", note: "No deadline is published yet. Check the official page." },
  );
  return steps;
}
