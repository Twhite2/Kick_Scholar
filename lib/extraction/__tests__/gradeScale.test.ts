import { describe, it, expect } from "vitest";
import { normaliseGradeDirection, normaliseGradeDirections } from "../llm/gradeScale";

/**
 * Every quote below is real text from a crawled DAAD programme page. The point
 * is that all of them pass the verbatim-quote guard — the inversion is a
 * separate class of error that grounding cannot catch.
 */
const req = (over: Partial<Parameters<typeof normaliseGradeDirection>[0]> = {}) => ({
  requirementType: "MIN_GPA",
  operator: "GTE",
  value: "2.7",
  unit: "German grading system",
  sourceQuote: "Overall grade equivalent to at least 2.7 (German grading system) in the Bachelor's degree",
  ...over,
});

describe("normaliseGradeDirection", () => {
  it('flips "at least 2.7" on the German scale to a <= comparison', () => {
    const { requirement, corrected } = normaliseGradeDirection(req());
    expect(corrected).toBe(true);
    expect(requirement.operator).toBe("LTE");
  });

  it("leaves the quote untouched so the audit trail still matches the page", () => {
    const original = req();
    const { requirement } = normaliseGradeDirection(original);
    expect(requirement.sourceQuote).toBe(original.sourceQuote);
  });

  it("detects the scale from the quote when no unit was extracted", () => {
    const { corrected } = normaliseGradeDirection(
      req({
        unit: null,
        sourceQuote:
          "The grade point average of your Bachelor's degree should at least correspond to the German grade 2.5",
      }),
    );
    expect(corrected).toBe(true);
  });

  it("leaves an already-correct comparison alone", () => {
    const { requirement, corrected } = normaliseGradeDirection(
      req({
        operator: "LT",
        value: "3.0",
        sourceQuote: "The Bachelor's grade must be below 3.0 in the German system (where 1.0 is best).",
      }),
    );
    expect(corrected).toBe(false);
    expect(requirement.operator).toBe("LT");
  });

  it("does not touch a 4.0-scale GPA that merely mentions Germany", () => {
    // 3.5 sits outside the German pass range, so this is a US-style GPA where
    // GTE is genuinely correct. Flipping it would invent a failure.
    const { corrected } = normaliseGradeDirection(
      req({
        value: "3.5",
        unit: null,
        sourceQuote: "A minimum GPA of 3.5 is required for applicants to this German university.",
      }),
    );
    expect(corrected).toBe(false);
  });

  it("ignores requirements that are not grades", () => {
    const { corrected } = normaliseGradeDirection(
      req({ requirementType: "LANGUAGE_TEST", value: "6.5", unit: null, sourceQuote: "IELTS 6.5 required at this German university" }),
    );
    expect(corrected).toBe(false);
  });
});

describe("normaliseGradeDirection — wording a narrower rule missed", () => {
  // Every quote here is verbatim from a loaded DAAD programme. A first version
  // matched only "german (grading )?(system|scale|grade)" and let all of these
  // through, each one a real requirement that would have mis-scored students.
  const cases: Array<[string, Partial<Parameters<typeof normaliseGradeDirection>[0]>]> = [
    ["German grading scheme", {
      value: "2.5", unit: "German grading scheme",
      sourceQuote: "with an overall grade of at least 2.5, according to the German grading scheme",
    }],
    ["German scoring system", {
      value: "2.5", unit: null,
      sourceQuote: "A Bachelor's degree in English with a minimum average of 2.5 (= German scoring system) is required.",
    }],
    ["German university grading system", {
      value: "2.3", unit: null,
      sourceQuote: "A minimum grade of 2.3 (German university grading system) as the overall grade of the previous degree",
    }],
    ["German GPA", {
      value: "2.3", unit: null,
      sourceQuote: "The grade point average (GPA) of the prior academic degree needs to correspond to a German GPA of at least 2.3.",
    }],
    ["German marking system", {
      value: "2.7", unit: null,
      sourceQuote: "with a final grade of 2.7 or better (according to the German marking system or the relevant foreign equivalent grade).",
    }],
    ["no grading vocabulary at all, only the country", {
      value: "2.0", unit: null,
      sourceQuote: "An equivalent qualification obtained in Germany or abroad with an overall grade of 2.0 or higher is required.",
    }],
  ];

  for (const [label, over] of cases) {
    it(`flips "${label}"`, () => {
      expect(normaliseGradeDirection(req(over)).requirement.operator).toBe("LTE");
    });
  }

  it("is not fooled by an unrelated percentage in the same sentence", () => {
    // "best 50% of your cohort" is an alternative admission route, not the
    // scale of this threshold. Treating any % as a competing scale silently
    // suppressed this genuine correction.
    const { corrected } = normaliseGradeDirection(
      req({
        value: "2.5", unit: null,
        sourceQuote:
          "with the result of 2.5 or better according to the German marking system (or an equivalent grade in a foreign grading system) or be ranked among the best 50% of your cohort.",
      }),
    );
    expect(corrected).toBe(true);
  });

  it("believes a page that states a different scale outright", () => {
    const { corrected } = normaliseGradeDirection(
      req({
        value: "3.0", unit: null,
        sourceQuote: "GPA of at least 3.0 out of 100, or in the German grading system a good result",
      }),
    );
    expect(corrected).toBe(false);
  });
});

describe("normaliseGradeDirections", () => {
  it("counts the corrections it made", () => {
    const { corrected } = normaliseGradeDirections([
      req(),
      req({ value: "2.5" }),
      req({ operator: "LTE" }),
    ]);
    expect(corrected).toBe(2);
  });
});
