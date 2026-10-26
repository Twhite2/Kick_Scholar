import { describe, expect, it } from "vitest";
import { scoreTarget } from "../scoreTarget";
import { requirementScale, toGermanScale, convertStudentGrade } from "../gradeConversion";
import { baseProfile, baseProgramTarget } from "./fixtures";
import type { RequirementLike } from "../types";

const req = (r: Partial<RequirementLike>): RequirementLike => ({
  requirementType: "MIN_GPA",
  testName: null,
  operator: "GTE",
  value: "0",
  unit: null,
  verified: true,
  ...r,
});

const factor = (target: ReturnType<typeof baseProgramTarget>, profile = baseProfile(), name = "ACADEMIC_COMPATIBILITY") =>
  scoreTarget(profile, target, true).factorScores.find((f) => f.factor === name)!;

describe("grade scale conversion", () => {
  it("recognises German-scale requirements by unit or by inverted operator", () => {
    expect(requirementScale("LTE", 2.7, "German scale (1.0 best – 4.0 pass)")).toEqual({ kind: "german" });
    expect(requirementScale("LTE", 2.5, null)).toEqual({ kind: "german" });
    expect(requirementScale("GTE", 3.0, null)).toEqual({ kind: "ascending", max: 4 });
    expect(requirementScale("GTE", 75, null)).toEqual({ kind: "ascending", max: 100 });
  });

  it("uses a scale stated in the unit and ignores credit counts", () => {
    expect(requirementScale("GTE", 3.75, "5.0")).toEqual({ kind: "ascending", max: 5 });
    expect(requirementScale("EQ", 2.7, "CGPA out of 4.0")).toEqual({ kind: "ascending", max: 4 });
    expect(requirementScale("EQ", 210, "ECTS credits")).toBeNull();
    expect(requirementScale("GTE", 80, "credit points")).toBeNull();
  });

  it("converts with the modified Bavarian formula", () => {
    expect(toGermanScale(4.0, 4)).toBe(1);
    expect(toGermanScale(3.8, 4)).toBe(1.3);
    expect(toGermanScale(3.0, 4)).toBe(2.5);
    expect(toGermanScale(85, 100)).toBe(1.9);
  });

  it("refuses to convert to German without the student's scale", () => {
    expect(convertStudentGrade(3.8, null, { kind: "german" })).toBeNull();
  });
});

describe("GPA against German-scale requirements", () => {
  const german = (value: string) =>
    baseProgramTarget({ requirements: [req({ operator: "LTE", value, unit: "German scale (1.0 best – 4.0 pass)" })] });

  it("passes a strong US student on a German 2.7 requirement", () => {
    // Previously 3.8 <= 2.7 was compared raw and failed.
    expect(factor(german("2.7"), baseProfile({ currentGpa: 3.8, gpaScale: 4 })).score).toBe(100);
  });

  it("fails a weak US student on a strict German requirement", () => {
    expect(factor(german("1.5"), baseProfile({ currentGpa: 3.0, gpaScale: 4 })).score).toBe(30);
  });

  it("converts a percentage grade", () => {
    expect(factor(german("2.5"), baseProfile({ currentGpa: 85, gpaScale: 100 })).score).toBe(100);
  });

  it("asks for the GPA scale instead of guessing", () => {
    const f = factor(german("2.5"), baseProfile({ currentGpa: 3.8, gpaScale: null }));
    expect(f.score).toBeNull();
    expect(f.missingProfileData).toBe("GPA scale");
  });

  it("treats an unreadable value as not assessable, not as a fail", () => {
    expect(factor(baseProgramTarget({ requirements: [req({ value: "2.5 (German scale)" })] }), baseProfile({ currentGpa: 3.8 })).score).toBeNull();
  });

  it("scales a percentage student onto a 4-point requirement", () => {
    expect(factor(baseProgramTarget({ requirements: [req({ value: "3.0" })] }), baseProfile({ currentGpa: 85, gpaScale: 100 })).score).toBe(100);
    expect(factor(baseProgramTarget({ requirements: [req({ value: "3.5" })] }), baseProfile({ currentGpa: 70, gpaScale: 100 })).score).toBe(30);
  });
});

describe("language alternatives", () => {
  const lang = (testName: string | null, value: string, operator: RequirementLike["operator"] = "GTE") =>
    req({ requirementType: "LANGUAGE_TEST", testName, value, operator });
  const languageScore = (requirements: RequirementLike[], proficiencies: Array<{ testName: string; score: number | null; cefrLevel: string | null }>) =>
    factor(baseProgramTarget({ requirements }), baseProfile({ languageProficiencies: proficiencies }), "LANGUAGE_COMPATIBILITY");

  it("matches 'IELTS Academic' to a student's 'IELTS'", () => {
    expect(languageScore([lang("IELTS Academic", "6.5")], [{ testName: "IELTS", score: 7, cefrLevel: null }]).score).toBe(100);
  });

  it("treats IELTS or TOEFL as alternatives", () => {
    const f = languageScore([lang("IELTS Academic", "6.5"), lang("TOEFL iBT", "90")], [{ testName: "TOEFL", score: 95, cefrLevel: null }]);
    expect(f.score).toBe(100);
  });

  it("does not compare a TOEFL score against an IELTS requirement", () => {
    const f = languageScore([lang("IELTS Academic", "6.5")], [{ testName: "TOEFL", score: 100, cefrLevel: null }]);
    expect(f.score).toBe(0);
  });

  it("ignores a requirement that names no test instead of using the first score on file", () => {
    expect(languageScore([lang(null, "6.5")], [{ testName: "TOEFL", score: 100, cefrLevel: null }]).score).toBeNull();
  });

  it("does not compare old-scale TOEFL scores with 2026 bands", () => {
    const f = languageScore([lang("TOEFL iBT (since 2026)", "4.5")], [{ testName: "TOEFL iBT", score: 100, cefrLevel: null }]);
    expect(f.score).toBe(0);
  });

  it("compares CEFR levels, treating EQ as a floor", () => {
    expect(languageScore([lang("English", "B2", "EQ")], [{ testName: "IELTS", score: 7, cefrLevel: "C1" }]).score).toBe(100);
    expect(languageScore([lang("English", "C1")], [{ testName: "IELTS", score: 6, cefrLevel: "B2" }]).score).toBe(20);
  });

  it("answers a CEFR-only requirement from a test score", () => {
    expect(languageScore([lang("English", "B2")], [{ testName: "IELTS", score: 7, cefrLevel: null }]).score).toBe(100);
    expect(languageScore([lang("English", "C1")], [{ testName: "IELTS", score: 6.5, cefrLevel: null }]).score).toBe(20);
    expect(languageScore([lang("English", "C1")], [{ testName: "TOEFL iBT", score: 100, cefrLevel: null }]).score).toBe(100);
    expect(languageScore([lang("English", "C1")], [{ testName: "TOEFL iBT", score: 4.5, cefrLevel: null }]).score).toBe(20);
  });

  it("requires every language when a programme asks for English and German", () => {
    const f = languageScore(
      [lang("IELTS Academic", "6.5"), lang("German", "B1")],
      [{ testName: "IELTS", score: 7, cefrLevel: null }],
    );
    expect(f.score).toBe(0);
    expect(f.missingProfileData).toBe("German");
  });
});
