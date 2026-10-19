import type {
  FactorScore,
  MatchTarget,
  StudentLanguageProficiencyLike,
  StudentProfileForMatching,
} from "../types";
import { compareNumeric } from "../compare";

/**
 * Programmes list language tests as alternatives — "IELTS 6.5 or TOEFL iBT 90
 * or B2" — and may require more than one language (English AND German). So
 * requirements are grouped by language, and the student must satisfy one
 * alternative in every group.
 *
 * Names never match exactly: pages say "IELTS Academic" or "TOEFL iBT (since
 * 2026)" where a student types "IELTS". Matching is by test family.
 */

type Language = "ENGLISH" | "GERMAN";

const TEST_FAMILIES: Array<{ family: string; pattern: RegExp; language: Language | null }> = [
  { family: "IELTS", pattern: /ielts/i, language: "ENGLISH" },
  { family: "TOEFL", pattern: /toefl/i, language: "ENGLISH" },
  { family: "PTE", pattern: /\bpte\b/i, language: "ENGLISH" },
  { family: "CAMBRIDGE", pattern: /cambridge|\b(cae|fce|cpe)\b/i, language: "ENGLISH" },
  { family: "DUOLINGO", pattern: /duolingo/i, language: "ENGLISH" },
  { family: "TESTDAF", pattern: /testdaf/i, language: "GERMAN" },
  { family: "DSH", pattern: /\bdsh\b/i, language: "GERMAN" },
  { family: "GOETHE", pattern: /goethe/i, language: "GERMAN" },
  // Language-neutral brands: the language comes from the rest of the name.
  { family: "TELC", pattern: /\btelc\b/i, language: null },
  { family: "UNICERT", pattern: /unicert/i, language: null },
];

const CEFR_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"];

function testFamily(name: string | null): string | null {
  if (!name) return null;
  return TEST_FAMILIES.find((t) => t.pattern.test(name))?.family ?? null;
}

function languageOf(name: string | null): Language | null {
  if (!name) return null;
  if (/english/i.test(name)) return "ENGLISH";
  if (/german|deutsch/i.test(name)) return "GERMAN";
  return TEST_FAMILIES.find((t) => t.pattern.test(name))?.language ?? null;
}

function cefrRank(text: string | null): number | null {
  const level = text?.match(/\b([ABC][12])\b/i)?.[1].toUpperCase();
  return level ? CEFR_ORDER.indexOf(level) : null;
}

/**
 * A student usually enters a test score, not a CEFR level, while many
 * programmes state only "English B2". Published test→CEFR equivalences let
 * the score answer that requirement. Each entry is [minimum score, CEFR rank].
 */
const SCORE_TO_CEFR: Record<string, Array<[number, number]>> = {
  // IELTS (British Council / IDP): 4.0 B1, 5.5 B2, 7.0 C1, 8.5 C2.
  IELTS: [[8.5, 5], [7, 4], [5.5, 3], [4, 2]],
  // TOEFL iBT 0–120 (ETS): 42 B1, 72 B2, 95 C1, 114 C2.
  TOEFL_LEGACY: [[114, 5], [95, 4], [72, 3], [42, 2]],
  // TOEFL iBT 1–6 bands (2026) are aligned to CEFR: band 1 = A1 … 6 = C2.
  TOEFL_BAND: [[6, 5], [5, 4], [4, 3], [3, 2], [2, 1], [1, 0]],
};

function studentCefrRank(p: StudentLanguageProficiencyLike): number | null {
  const stated = cefrRank(p.cefrLevel);
  if (stated !== null) return stated;
  const family = testFamily(p.testName);
  if (p.score === null || family === null) return null;
  const table =
    family === "IELTS" ? SCORE_TO_CEFR.IELTS
    : family === "TOEFL" ? (p.score <= 6 ? SCORE_TO_CEFR.TOEFL_BAND : SCORE_TO_CEFR.TOEFL_LEGACY)
    : null;
  return table?.find(([min]) => p.score! >= min)?.[1] ?? null;
}

/**
 * TOEFL iBT moved to a 1–6 band scale in 2026; older scores run 0–120. A
 * band and a legacy score are not comparable, so the pair is skipped rather
 * than letting 100 trivially "meet" a band of 4.5.
 */
function sameScoreScale(family: string, required: number, actual: number): boolean {
  if (family !== "TOEFL") return true;
  return required <= 6 === actual <= 6;
}

interface Alternative {
  label: string;
  language: Language | null;
  family: string | null;
  operator: Parameters<typeof compareNumeric>[0];
  score: number | null;
  cefr: number | null;
  text: string;
}

function alternatives(target: MatchTarget): Alternative[] {
  const fromRequirements = target.requirements
    .filter((r) => r.requirementType === "LANGUAGE_TEST")
    .map((r) => {
      const context = `${r.testName ?? ""} ${r.unit ?? ""}`;
      const numeric = Number(r.value.replace(",", "."));
      return {
        label: r.testName ?? r.value,
        language: languageOf(context),
        family: testFamily(context),
        operator: r.operator,
        score: Number.isFinite(numeric) ? numeric : null,
        cefr: cefrRank(r.value),
        text: `${r.operator} ${r.value}`,
      };
    });
  const fromEligibility = target.eligibility
    .filter((e) => e.criterionType === "LANGUAGE")
    .map((e) => {
      const context = `${e.textValue ?? ""} ${e.valueList.join(" ")}`;
      return {
        label: e.textValue ?? e.valueList.join(", "),
        language: languageOf(context),
        family: testFamily(context),
        operator: e.operator,
        score: e.numericValue,
        cefr: cefrRank(context),
        text: e.numericValue !== null ? `${e.operator} ${e.numericValue}` : context.trim(),
      };
    });
  // Only alternatives we can actually evaluate: a scored test we can identify,
  // or a CEFR level. "Good English skills" (BOOLEAN_TRUE) is neither.
  return [...fromRequirements, ...fromEligibility].filter(
    (a) => (a.score !== null && a.family !== null) || a.cefr !== null,
  );
}

/** true = met, false = student has comparable data but falls short, null = no comparable data. */
function evaluate(alt: Alternative, proficiencies: StudentLanguageProficiencyLike[]): boolean | null {
  let sawComparable = false;
  for (const p of proficiencies) {
    if (alt.score !== null && alt.family !== null && testFamily(p.testName) === alt.family) {
      if (p.score !== null && sameScoreScale(alt.family, alt.score, p.score)) {
        sawComparable = true;
        if (compareNumeric(alt.operator === "EQ" ? "GTE" : alt.operator, alt.score, p.score)) return true;
      }
    }
    if (alt.cefr !== null) {
      const studentRank = studentCefrRank(p);
      const studentLanguage = languageOf(p.testName);
      const languageFits = !alt.language || !studentLanguage || alt.language === studentLanguage;
      if (studentRank !== null && languageFits) {
        sawComparable = true;
        // CEFR requirements state a floor even when written as "EQ B2".
        if (studentRank >= alt.cefr) return true;
      }
    }
  }
  return sawComparable ? false : null;
}

export function languageCompatibility(
  profile: StudentProfileForMatching,
  target: MatchTarget,
): FactorScore {
  const alts = alternatives(target);
  if (alts.length === 0) {
    const anyStated =
      target.requirements.some((r) => r.requirementType === "LANGUAGE_TEST") ||
      target.eligibility.some((e) => e.criterionType === "LANGUAGE");
    return {
      factor: "LANGUAGE_COMPATIBILITY",
      score: null,
      weight: 0,
      explanation: anyStated
        ? "A language requirement is stated but isn't a scoreable test threshold or CEFR level."
        : "No language test requirement is published for this opportunity.",
    };
  }

  const groups = new Map<string, Alternative[]>();
  for (const a of alts) {
    const key = a.language ?? "UNSPECIFIED";
    groups.set(key, [...(groups.get(key) ?? []), a]);
  }

  const unmet: Alternative[][] = [];
  const missing: Alternative[][] = [];
  for (const group of groups.values()) {
    const results = group.map((a) => evaluate(a, profile.languageProficiencies));
    if (results.includes(true)) continue;
    if (results.includes(false)) unmet.push(group);
    else missing.push(group);
  }

  const describe = (group: Alternative[]) =>
    group.map((a) => `${a.label} ${a.text}`).join(" or ");

  if (unmet.length === 0 && missing.length === 0) {
    return {
      factor: "LANGUAGE_COMPATIBILITY",
      score: 100,
      weight: 0,
      explanation: "Your language scores meet the stated requirements.",
    };
  }
  if (unmet.length > 0) {
    return {
      factor: "LANGUAGE_COMPATIBILITY",
      score: 20,
      weight: 0,
      explanation: `Your language scores are below what's required: ${unmet.map(describe).join("; ")}.`,
    };
  }
  return {
    factor: "LANGUAGE_COMPATIBILITY",
    score: 0,
    weight: 0,
    explanation: `${missing.map(describe).join("; ")} is required — no matching score on file.`,
    missingProfileData: missing[0].map((a) => a.label).join(" or "),
  };
}
