import type { FactorKey, FactorScore } from "@/lib/matching/types";
import { blockerOf, type Blocker } from "./blockers";
import { formatMoney, truncateWords } from "./format";

/**
 * Short, plain reasons for the billboard and poster previews
 * (docs/ui-remodel.md §9.1.1, §14.5): the two highest-weight factors the
 * student meets, then the first blocker.
 *
 * Every sentence restates what a factor score already means. When there is
 * nothing specific to say, the engine's own explanation is used (trimmed),
 * never an invented detail.
 */

export interface Reason {
  text: string;
  met: boolean;
}

export interface ReasonContext {
  profile: {
    currentGpa: number | null;
    languageProficiencies: Array<{ testName: string; score: number | null }>;
  } | null;
  target: {
    kind: "PROGRAM" | "SCHOLARSHIP";
    degreeLevel?: string | null;
    fieldCategory?: string | null;
    tuitionType?: string | null;
    tuitionAmount?: number | null;
    tuitionCurrency?: string | null;
    universityType?: string | null;
    requirements?: Array<{ requirementType: string; testName: string | null; value: string; unit: string | null }>;
  };
  /** An officially linked scholarship's name, for "{name} applies to this programme". */
  linkedScholarshipName?: string | null;
}

const MET_THRESHOLD = 80;

const FIELD_LABEL: Record<string, string> = {
  STEM: "STEM",
  BUSINESS: "Business",
  HUMANITIES: "Humanities",
  SOCIAL_SCIENCES: "Social sciences",
  ARTS: "Arts",
  HEALTH: "Health",
  LAW: "Law",
  EDUCATION: "Education",
  OTHER: "This field",
};

const DEGREE_WORD: Record<string, string> = {
  BACHELOR: "bachelor's",
  MASTER: "master's",
  PHD: "PhD",
  DIPLOMA: "diploma",
  CERTIFICATE: "certificate",
};

const ENGLISH_TEST = /ielts|toefl|\bpte\b|cambridge|duolingo/i;

function firstRequirement(ctx: ReasonContext, type: string) {
  return ctx.target.requirements?.find((r) => r.requirementType === type) ?? null;
}

/** "IELTS 6.5" from a LANGUAGE_TEST requirement row. */
export function languageRequirementText(ctx: ReasonContext): string | null {
  const reqs = ctx.target.requirements?.filter((r) => r.requirementType === "LANGUAGE_TEST") ?? [];
  const req = reqs.find((r) => ENGLISH_TEST.test(r.testName ?? "")) ?? reqs[0];
  if (!req) return null;
  const value = req.value.trim();
  const name = (req.testName ?? "").trim();
  // Only print values that say something: "IELTS 6.5", "English at B2" —
  // never "IELTS true" from a yes/no requirement.
  const cefr = /^[ABC][12]$/i.test(value);
  const numeric = /^\d+([.,]\d+)?$/.test(value);
  if (!name) return cefr ? `English at ${value.toUpperCase()}` : null;
  return numeric || cefr ? `${name} ${cefr ? value.toUpperCase() : value}` : name;
}

function englishTestOnFile(ctx: ReasonContext) {
  return ctx.profile?.languageProficiencies.find((p) => ENGLISH_TEST.test(p.testName) && p.score !== null) ?? null;
}

function metText(f: FactorScore, ctx: ReasonContext, short: boolean): string {
  switch (f.factor) {
    case "ACADEMIC_COMPATIBILITY": {
      const gpa = ctx.profile?.currentGpa;
      if (short || gpa === null || gpa === undefined) return "CGPA clears the entry bar";
      return `Your ${gpa} CGPA clears the entry bar`;
    }
    case "FIELD_COMPATIBILITY": {
      const field = FIELD_LABEL[ctx.target.fieldCategory ?? ""] ?? "The field";
      return short ? `${field} fits your plans` : `${field} fits what you want to study`;
    }
    case "DEGREE_COMPATIBILITY": {
      const word = DEGREE_WORD[ctx.target.degreeLevel ?? ""];
      if (!word) return "Degree level fits";
      return short ? `${word.charAt(0).toUpperCase()}${word.slice(1)} level fits` : `The ${word} level you're looking for`;
    }
    case "LANGUAGE_COMPATIBILITY": {
      const test = englishTestOnFile(ctx);
      if (short || !test) return "Language scores meet the requirement";
      return `Your ${test.testName} ${test.score} meets the requirement`;
    }
    case "BUDGET_COMPATIBILITY": {
      if (ctx.target.tuitionType === "FREE") {
        return !short && ctx.target.universityType === "PUBLIC"
          ? "No tuition fees at this public university"
          : "No tuition fees";
      }
      return "Tuition fits your budget";
    }
    case "SCHOLARSHIP_ELIGIBILITY": {
      if (ctx.target.kind === "PROGRAM") {
        if (ctx.linkedScholarshipName) {
          return short
            ? truncateWords(`${ctx.linkedScholarshipName} applies`, 48)
            : truncateWords(`${ctx.linkedScholarshipName} applies to this programme`, 80);
        }
        return short ? "Linked funding fits you" : truncateWords(f.explanation.replace(/\.$/, ""), 80);
      }
      return short ? "Eligibility criteria met" : "You meet the criteria we could check";
    }
    case "COUNTRY_PREFERENCE":
      return short ? "Preferred country" : "In one of your preferred countries";
    case "WORK_EXPERIENCE":
      return short ? "Experience fits" : "Your work experience meets the requirement";
    default:
      return truncateWords(f.explanation.replace(/\.$/, ""), short ? 48 : 80);
  }
}

function gapText(b: Blocker, ctx: ReasonContext, short: boolean): string {
  switch (b.kind) {
    case "ENGLISH_TEST_MISSING":
    case "LANGUAGE_TEST_MISSING": {
      const req = languageRequirementText(ctx);
      return req ? `Needs ${req}` : "Needs a language test result";
    }
    case "ENGLISH_SCORE_LOW":
    case "LANGUAGE_SCORE_LOW": {
      const req = languageRequirementText(ctx);
      return req ? `Needs ${req}` : "Needs a higher language score";
    }
    case "CGPA_BELOW_MIN":
      // Grades are compared after converting to the university's scale, so a
      // bare threshold ("2.5" on the German scale) would read as the wrong number.
      return short ? "Grades below the entry bar" : "Your grades are below the stated entry bar";
    case "BUDGET_OVER": {
      const { tuitionAmount, tuitionCurrency } = ctx.target;
      if (!short && tuitionAmount && tuitionCurrency) {
        return `Tuition of ${formatMoney(tuitionAmount, tuitionCurrency)} is above your budget`;
      }
      return "Tuition is above your budget";
    }
    case "WORK_EXPERIENCE_SHORT":
    case "WORK_EXPERIENCE_MISSING": {
      const req = firstRequirement(ctx, "WORK_EXPERIENCE");
      return req ? `Needs ${req.value} ${req.unit ?? "months"} of work experience` : "Needs more work experience";
    }
    case "DEGREE_NOT_ELIGIBLE":
      return "Needs a completed prior degree";
    case "NOT_ELIGIBLE":
      return truncateWords(b.explanation.replace(/\.$/, ""), short ? 48 : 80);
  }
}

/** Weight order, heaviest first, as the engine weighs them. */
function byWeight(a: FactorScore, b: FactorScore): number {
  return b.weight - a.weight;
}

export function buildReasons(
  factorScores: FactorScore[],
  ctx: ReasonContext,
  options: { short?: boolean; max?: number } = {},
): Reason[] {
  const short = options.short ?? false;
  const max = options.max ?? 3;
  const sorted = [...factorScores].sort(byWeight);
  const met = sorted
    .filter((f) => !f.hardFail && f.score !== null && f.score >= MET_THRESHOLD)
    .slice(0, 2)
    .map((f) => ({ text: metText(f, ctx, short), met: true }));
  const blocker = sorted.map(blockerOf).find((b): b is Blocker => b !== null);
  const reasons = blocker ? [...met, { text: gapText(blocker, ctx, short), met: false }] : met;
  // Dedupe identical sentences (two factors can phrase the same way).
  const seen = new Set<string>();
  return reasons.filter((r) => (seen.has(r.text) ? false : (seen.add(r.text), true))).slice(0, max);
}

/** "7 of 8 checks met", or null when the engine assessed nothing. */
export function basisLine(factorScores: FactorScore[]): string | null {
  const evaluated = factorScores.filter((f) => f.score !== null);
  if (evaluated.length === 0) return null;
  const met = evaluated.filter((f) => !f.hardFail && (f.score ?? 0) >= MET_THRESHOLD).length;
  return `${met} of ${evaluated.length} checks met`;
}

/** Re-exported for callers that only need the factor keys. */
export type { FactorKey };
