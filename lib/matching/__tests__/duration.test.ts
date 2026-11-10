import { describe, it, expect } from "vitest";
import { durationToMonths, formatMonths } from "../duration";

/**
 * The units below are the ones actually present on the 168 work-experience
 * requirements in the catalogue: 100 in years, 17 in months, 14 in weeks, and
 * a handful mis-filed as academic credits.
 */
describe("durationToMonths", () => {
  it("converts years, which are the majority of real requirements", () => {
    expect(durationToMonths(5, "years", null)).toBe(60);
    expect(durationToMonths(1, "year", null)).toBe(12);
  });

  it("passes months through unchanged", () => {
    expect(durationToMonths(18, "months", null)).toBe(18);
  });

  it("converts weeks on a mean-month basis, not a 4-week one", () => {
    // 18 weeks is a bit over four months; rounding to exactly four would make
    // a borderline student fail.
    expect(durationToMonths(18, "weeks", null)).toBeCloseTo(4.14, 2);
  });

  it("uses the semester convention the programme parser already uses", () => {
    expect(durationToMonths(2, "semesters", null)).toBe(12);
  });

  it("infers the unit from the page's own sentence when none was extracted", () => {
    expect(
      durationToMonths(3, null, "Applicants need at least 3 years of relevant professional experience."),
    ).toBe(36);
  });

  it("refuses to guess when the sentence names more than one unit", () => {
    expect(
      durationToMonths(2, null, "Either 2 of professional practice, or 18 months, or 6 weeks of placement."),
    ).toBeNull();
  });

  it("refuses academic credits, which are not a duration at all", () => {
    // "180 ECTS" filed as WORK_EXPERIENCE would otherwise become a 15-year
    // demand that no student could meet.
    expect(durationToMonths(180, "ECTS credits in economics", null)).toBeNull();
    expect(durationToMonths(30, "CP", null)).toBeNull();
    expect(durationToMonths(180, null, "A degree worth at least 180 ECTS credits")).toBeNull();
  });

  it("returns null rather than assuming months for an unknown scale", () => {
    expect(durationToMonths(4, null, null)).toBeNull();
    expect(durationToMonths(4, "widgets", null)).toBeNull();
  });

  it("digs a unit out of free-text unit strings", () => {
    expect(durationToMonths(2, "years of professional experience", null)).toBe(24);
  });
});

describe("formatMonths", () => {
  it("says months below a year and years above it", () => {
    expect(formatMonths(6)).toBe("6 months");
    expect(formatMonths(1)).toBe("1 month");
    expect(formatMonths(24)).toBe("2 years");
    expect(formatMonths(84)).toBe("7 years");
  });
});
