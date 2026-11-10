import type { FactorKey, FactorScore } from "@/lib/matching/types";
import { countryName } from "./country";
import { formatDuration } from "./format";

/**
 * Rows for "Why you match" (docs/ui-remodel.md §9.3): each requirement next
 * to what the student has, with a status read from the engine's factor for
 * that requirement. Where the engine doesn't assess something (a portfolio,
 * a subject prerequisite), the row says so rather than guessing.
 */

export type RowStatus = "met" | "missing" | "unknown";

export interface ComparisonRow {
  key: string;
  label: string;
  theyAsk: string;
  youHave: string | null;
  status: RowStatus;
  /** Shown with "Not added yet": where to fix it. */
  action?: { label: string; href: string };
}

export interface ProfileForComparison {
  nationality: string | null;
  currentEducationLevel: string | null;
  fieldOfStudy: string | null;
  currentGpa: number | null;
  gpaScale: number | null;
  workExperienceMonths: number | null;
  financialNeedSelfReported: boolean | null;
  languageProficiencies: Array<{ testName: string; score: number | null; cefrLevel: string | null }>;
}

const LEVEL: Record<string, string> = {
  HIGH_SCHOOL: "Secondary school",
  BACHELOR: "Bachelor's",
  MASTER: "Master's",
  PHD: "PhD",
  DIPLOMA: "Diploma",
  CERTIFICATE: "Certificate",
  OTHER: "Other qualification",
};

export function degreeLabel(level: string | null | undefined): string | null {
  return level ? (LEVEL[level] ?? null) : null;
}

const ADD_TEST = { label: "Add test score", href: "/profile#language" };
const ADD_CGPA = { label: "Add CGPA", href: "/profile#academic" };
const ADD_EXPERIENCE = { label: "Update experience", href: "/profile#experience" };
const ADD_DEGREE = { label: "Add your degree", href: "/profile#academic" };
const ADD_NATIONALITY = { label: "Add nationality", href: "/profile#personal" };

function factorOf(factors: FactorScore[], key: FactorKey) {
  return factors.find((f) => f.factor === key) ?? null;
}

/** Engine score -> row status. Thresholds are the factors' own fixed values. */
function statusFromFactor(f: FactorScore | null, opts: { passAt?: number } = {}): RowStatus {
  if (!f || f.score === null) return "unknown";
  if (f.hardFail) return "missing";
  if (f.score >= (opts.passAt ?? 100)) return "met";
  return "missing";
}

function informative(value: string): boolean {
  return /^\d+([.,]\d+)?$/.test(value.trim()) || /^[ABC][12]$/i.test(value.trim());
}

function languageAsk(r: { testName: string | null; value: string; description: string | null }): string {
  const name = r.testName?.trim();
  if (name && informative(r.value)) return `${name} ${r.value.trim().toUpperCase()}`;
  if (name) return name;
  if (informative(r.value)) return `English at ${r.value.trim().toUpperCase()}`;
  return r.description ? truncate(r.description) : r.value;
}

function gradeAsk(r: { operator: string; value: string; unit: string | null }): string {
  const scale = r.unit ? ` (${r.unit})` : "";
  if (r.operator === "LTE" || r.operator === "LT") return `${r.value} or better${scale}`;
  return `At least ${r.value}${scale}`;
}

/** Source text arrives as markdown fragments: drop emphasis and link syntax. */
export function cleanSourceText(s: string): string {
  return s
    .replace(/\*\*|__/g, "")
    .replace(/(^|\s)\*(\S)/g, "$1$2")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(s: string, max = 140): string {
  const clean = cleanSourceText(s);
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
}

function yourLanguage(p: ProfileForComparison | null): string | null {
  if (!p || p.languageProficiencies.length === 0) return null;
  return p.languageProficiencies
    .map((l) => [l.testName, l.score ?? l.cefrLevel].filter((x) => x !== null && x !== undefined && x !== "").join(" "))
    .join(", ");
}

function yourGrade(p: ProfileForComparison | null): string | null {
  if (!p || p.currentGpa === null) return null;
  return p.gpaScale ? `${p.currentGpa} on a ${p.gpaScale}-point scale` : String(p.currentGpa);
}

function yourExperience(p: ProfileForComparison | null): string | null {
  if (!p || p.workExperienceMonths === null) return null;
  if (p.workExperienceMonths === 0) return "None yet";
  return formatDuration(p.workExperienceMonths);
}

function yourDegree(p: ProfileForComparison | null): string | null {
  if (!p) return null;
  const level = degreeLabel(p.currentEducationLevel);
  if (!level) return null;
  return p.fieldOfStudy ? `${level} in ${p.fieldOfStudy}` : level;
}

const TYPE_LABEL: Record<string, string> = {
  LANGUAGE_TEST: "English or language test",
  MIN_GPA: "Minimum grade",
  DEGREE_PREREQUISITE: "Previous degree",
  WORK_EXPERIENCE: "Work experience",
  STANDARDIZED_TEST: "Standardised test",
  PORTFOLIO: "Portfolio",
  INTERVIEW: "Interview",
  OTHER: "Other requirement",
};

export function requirementTypeLabel(type: string): string {
  return TYPE_LABEL[type] ?? "Requirement";
}

/** Programme requirements, grouped where they are alternatives (language tests). */
export function programmeRows(
  requirements: Array<{ id: string; requirementType: string; testName: string | null; operator: string; value: string; unit: string | null; description: string | null }>,
  factors: FactorScore[],
  profile: ProfileForComparison | null,
): ComparisonRow[] {
  const rows: ComparisonRow[] = [];
  const language = requirements.filter((r) => r.requirementType === "LANGUAGE_TEST");
  if (language.length > 0) {
    const asks = [...new Set(language.map(languageAsk))];
    const status = statusFromFactor(factorOf(factors, "LANGUAGE_COMPATIBILITY"));
    const have = yourLanguage(profile);
    rows.push({
      key: "language",
      label: "English or language test",
      theyAsk: asks.slice(0, 4).join(" or "),
      youHave: have,
      status: have ? status : status === "met" ? "met" : "missing",
      action: have ? undefined : ADD_TEST,
    });
  }

  for (const r of requirements) {
    switch (r.requirementType) {
      case "LANGUAGE_TEST":
        break;
      case "MIN_GPA": {
        const have = yourGrade(profile);
        rows.push({
          key: r.id,
          label: "Minimum grade",
          theyAsk: gradeAsk(r),
          youHave: have,
          status: statusFromFactor(factorOf(factors, "ACADEMIC_COMPATIBILITY")),
          action: have ? undefined : ADD_CGPA,
        });
        break;
      }
      case "WORK_EXPERIENCE": {
        const have = yourExperience(profile);
        rows.push({
          key: r.id,
          label: "Work experience",
          theyAsk: informative(r.value) ? `${r.value} ${r.unit ?? "months"}` : truncate(r.description ?? r.value),
          youHave: have,
          status: statusFromFactor(factorOf(factors, "WORK_EXPERIENCE")),
          action: have ? undefined : ADD_EXPERIENCE,
        });
        break;
      }
      case "DEGREE_PREREQUISITE": {
        const degree = factorOf(factors, "DEGREE_COMPATIBILITY");
        const have = yourDegree(profile);
        rows.push({
          key: r.id,
          label: "Previous degree",
          theyAsk: truncate(r.description ?? r.value),
          youHave: have,
          // The engine checks the degree level, not the subject, so a level
          // that fits is still "check the details" rather than a tick.
          status: degree?.hardFail ? "missing" : "unknown",
          action: have ? undefined : ADD_DEGREE,
        });
        break;
      }
      default:
        rows.push({
          key: r.id,
          label: requirementTypeLabel(r.requirementType) + (r.testName ? `: ${r.testName}` : ""),
          theyAsk: truncate(r.description ?? r.value),
          youHave: null,
          status: "unknown",
        });
    }
  }
  return rows;
}

const CRITERION_LABEL: Record<string, string> = {
  NATIONALITY: "Nationality",
  DEGREE_LEVEL: "Degree level",
  FIELD_OF_STUDY: "Field of study",
  MIN_GPA: "Minimum grade",
  MAX_AGE: "Age limit",
  COUNTRY_OF_STUDY: "Country of study",
  UNIVERSITY: "University",
  FINANCIAL_NEED: "Financial need",
  ACADEMIC_EXCELLENCE: "Academic excellence",
  WORK_EXPERIENCE: "Work experience",
  LANGUAGE: "Language",
  OTHER: "Other criterion",
};

export function criterionLabel(type: string): string {
  return CRITERION_LABEL[type] ?? "Criterion";
}

/** Scholarship eligibility criteria against the profile. */
export function scholarshipRows(
  criteria: Array<{ id: string; criterionType: string; operator: string; valueList: string[]; numericValue: number | null; textValue: string | null; description: string | null }>,
  factors: FactorScore[],
  profile: ProfileForComparison | null,
): ComparisonRow[] {
  const eligibility = factorOf(factors, "SCHOLARSHIP_ELIGIBILITY");
  const failedLabels = eligibility?.hardFail ? eligibility.explanation.toLowerCase() : "";

  const ask = (c: (typeof criteria)[number]) => {
    if (c.valueList.length > 0) {
      // Country criteria may store ISO codes; print names.
      const names = c.valueList.map((v) => (/^[A-Z]{2}$/.test(v) ? countryName(v) : v));
      const list = names.slice(0, 6).join(", ");
      return c.valueList.length > 6 ? `${list} and ${c.valueList.length - 6} more` : list;
    }
    if (c.numericValue !== null) {
      if (c.criterionType === "MAX_AGE") return `${c.numericValue} or younger`;
      if (c.criterionType === "WORK_EXPERIENCE") return `${c.numericValue} months`;
      return `At least ${c.numericValue}`;
    }
    return truncate(c.textValue ?? c.description ?? "See the official page");
  };

  return criteria.map((c): ComparisonRow => {
    const base = { key: c.id, label: criterionLabel(c.criterionType), theyAsk: ask(c) };
    switch (c.criterionType) {
      case "NATIONALITY": {
        const have = profile?.nationality ?? null;
        const status: RowStatus = !have ? "unknown" : failedLabels.includes("nationality") ? "missing" : eligibility && !eligibility.hardFail && eligibility.score !== null ? "met" : "unknown";
        return { ...base, youHave: have, status, action: have ? undefined : ADD_NATIONALITY };
      }
      case "FINANCIAL_NEED": {
        const v = profile?.financialNeedSelfReported;
        const have = v === null || v === undefined ? null : v ? "Yes" : "No";
        const status: RowStatus = have === null ? "unknown" : failedLabels.includes("financial need") ? "missing" : v ? "met" : "unknown";
        return { ...base, youHave: have, status, action: have ? undefined : { label: "Update profile", href: "/profile#experience" } };
      }
      case "COUNTRY_OF_STUDY":
        return { ...base, youHave: null, status: failedLabels.includes("country of study") ? "missing" : "unknown" };
      case "DEGREE_LEVEL": {
        const have = yourDegree(profile);
        return { ...base, youHave: have, status: statusFromFactor(factorOf(factors, "DEGREE_COMPATIBILITY"), { passAt: 60 }), action: have ? undefined : ADD_DEGREE };
      }
      case "FIELD_OF_STUDY": {
        const f = factorOf(factors, "FIELD_COMPATIBILITY");
        return { ...base, youHave: profile?.fieldOfStudy ?? null, status: f?.score === 100 ? "met" : "unknown" };
      }
      case "MIN_GPA": {
        const have = yourGrade(profile);
        return { ...base, youHave: have, status: statusFromFactor(factorOf(factors, "ACADEMIC_COMPATIBILITY")), action: have ? undefined : ADD_CGPA };
      }
      case "WORK_EXPERIENCE": {
        const have = yourExperience(profile);
        return { ...base, youHave: have, status: statusFromFactor(factorOf(factors, "WORK_EXPERIENCE")), action: have ? undefined : ADD_EXPERIENCE };
      }
      case "LANGUAGE": {
        const have = yourLanguage(profile);
        return { ...base, youHave: have, status: statusFromFactor(factorOf(factors, "LANGUAGE_COMPATIBILITY")), action: have ? undefined : ADD_TEST };
      }
      default:
        return { ...base, youHave: null, status: "unknown" };
    }
  });
}

const FACTOR_LABEL: Record<FactorKey, string> = {
  ACADEMIC_COMPATIBILITY: "Academic fit",
  DEGREE_COMPATIBILITY: "Degree fit",
  FIELD_COMPATIBILITY: "Field fit",
  COUNTRY_PREFERENCE: "Country fit",
  LANGUAGE_COMPATIBILITY: "Language fit",
  BUDGET_COMPATIBILITY: "Budget fit",
  SCHOLARSHIP_ELIGIBILITY: "Scholarship eligibility",
  WORK_EXPERIENCE: "Experience fit",
};

export function factorLabel(factor: string): string {
  return FACTOR_LABEL[factor as FactorKey] ?? factor;
}

/** "Add your GPA to your profile" -> the profile section that fixes it. */
export function actionHref(text: string): string {
  if (/ielts|toefl|pte|duolingo|cambridge|language|english|test/i.test(text)) return "/profile#language";
  if (/gpa|grade|cgpa|education level|scale/i.test(text)) return "/profile#academic";
  if (/budget|fields|interested|countr/i.test(text)) return "/profile#preferences";
  if (/work experience|experience|financial need/i.test(text)) return "/profile#experience";
  if (/nationality|date of birth/i.test(text)) return "/profile#personal";
  return "/profile";
}
