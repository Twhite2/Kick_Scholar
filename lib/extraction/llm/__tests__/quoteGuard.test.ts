import { describe, it, expect } from "vitest";
import { checkQuote, filterByQuote } from "../quoteGuard";

const SOURCE = `### Target Group
graduates, doctoral candidates and post-doctoral researchers whose research
projects are related to the institutions of the Prussian Cultural Heritage
Foundation

### Application Requirements
Be **Under the age of 40** for Degree programs, and Under 45 for Training
Courses, at the time the training is scheduled to begin.`;

describe("checkQuote", () => {
  it("accepts a verbatim quote", () => {
    expect(checkQuote("graduates, doctoral candidates and post-doctoral researchers", SOURCE).ok).toBe(true);
  });

  it("accepts a quote whose whitespace differs (the source wraps lines)", () => {
    expect(checkQuote("post-doctoral researchers whose research projects are related", SOURCE).ok).toBe(true);
  });

  it("accepts a quote across markdown emphasis in the source", () => {
    // Source has "**Under the age of 40**"; the model quotes it unbolded.
    expect(checkQuote("Be Under the age of 40 for Degree programs", SOURCE).ok).toBe(true);
  });

  it("REJECTS a paraphrase — the whole point of the guard", () => {
    const r = checkQuote("Applicants must be younger than 40 years old", SOURCE);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("not-in-source");
  });

  it("rejects a quote too short to be evidence", () => {
    expect(checkQuote("graduates", SOURCE).reason).toBe("too-short");
  });

  it("rejects a dumped passage", () => {
    expect(checkQuote("x".repeat(700), SOURCE).reason).toBe("too-long");
  });
});

describe("filterByQuote", () => {
  it("keeps grounded facts and drops hallucinated ones, reporting both", () => {
    const items = [
      { sourceQuote: "graduates, doctoral candidates and post-doctoral researchers", id: "real" },
      { sourceQuote: "Applicants must hold a PhD from a German university", id: "fabricated" },
    ];
    const { kept, dropped } = filterByQuote(items, SOURCE);
    expect(kept.map((k) => k.id)).toEqual(["real"]);
    expect(dropped.map((d) => d.item.id)).toEqual(["fabricated"]);
    expect(dropped[0].reason).toBe("not-in-source");
  });
});

import { isPlausibleNumeric } from "../quoteGuard";

describe("isPlausibleNumeric", () => {
  it("rejects a nonsense age limit", () => {
    // Observed: the model returned MAX_AGE LT 6 for a postgraduate award.
    expect(isPlausibleNumeric("MAX_AGE", 6)).toBe(false);
    expect(isPlausibleNumeric("MAX_AGE", 35)).toBe(true);
  });
  it("leaves criteria without bounds alone", () => {
    expect(isPlausibleNumeric("NATIONALITY", 999)).toBe(true);
  });
  it("treats a null threshold as fine", () => {
    expect(isPlausibleNumeric("MAX_AGE", null)).toBe(true);
  });
});
