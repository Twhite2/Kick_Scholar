import { describe, expect, it } from "vitest";
import { isEarlyUcasCourse, isUcasCourse, ucasDeadlinesFor } from "../national";

const course = (over: Partial<Parameters<typeof ucasDeadlinesFor>[0]> = {}) => ({
  name: "Computer Science",
  degreeLevel: "BACHELOR",
  studyMode: "Full-time",
  country: "GB",
  universityName: "University of Leeds",
  ...over,
});

describe("UCAS 2027 dates", () => {
  it("gives most full-time undergraduate courses the January and June dates", () => {
    const dates = ucasDeadlinesFor(course());
    expect(dates.map((d) => d.date.toISOString())).toEqual(["2027-01-13T18:00:00.000Z", "2027-06-30T17:00:00.000Z"]);
    expect(dates[0].intake).toBe("2027 entry: UCAS equal consideration date");
    // The wording carries its year, so the annual refresh never rolls it to a guessed date.
    expect(dates.every((d) => /20\d\d/.test(d.dateText))).toBe(true);
  });

  it("gives Oxford, Cambridge and medicine, dentistry and veterinary only the October date", () => {
    for (const c of [
      course({ universityName: "University of Oxford", name: "History" }),
      course({ universityName: "University of Cambridge", name: "Engineering" }),
      course({ name: "Medicine" }),
      course({ name: "Medicine and Surgery" }),
      course({ name: "Medicine (Graduate Entry)" }),
      course({ name: "Foundation to Medicine (Year 0)" }),
      course({ name: "Dentistry" }),
      course({ name: "Dental Surgery" }),
      course({ name: "Dental Surgey with Integrated Foundation Year" }),
      course({ name: "Veterinary Medicine and Surgery" }),
      course({ name: "Bachelor of Veterinary Science" }),
      course({ name: "Clinical Veterinary Medicine" }),
    ]) {
      expect(ucasDeadlinesFor(c).map((d) => d.date.toISOString()), c.name).toEqual(["2026-10-15T17:00:00.000Z"]);
    }
  });

  it("keeps neighbouring subjects on the January date", () => {
    for (const name of [
      "Veterinary Nursing",
      "Bioveterinary Science",
      "Dental Hygiene and Therapy",
      "Dental Technology",
      "Biomedicine",
      "Cellular and Molecular Medicine",
      "Veterinary Physiotherapy",
    ]) {
      expect(isEarlyUcasCourse({ name, universityName: "University of Leeds" }), name).toBe(false);
    }
  });

  it("leaves part-time, non-UK and postgraduate courses alone", () => {
    expect(isUcasCourse(course({ studyMode: "Part-time" }))).toBe(false);
    expect(isUcasCourse(course({ studyMode: null }))).toBe(false);
    expect(isUcasCourse(course({ country: "AU" }))).toBe(false);
    expect(isUcasCourse(course({ degreeLevel: "MASTER" }))).toBe(false);
    expect(isUcasCourse(course({ studyMode: "Full-time or part-time" }))).toBe(true);
    expect(ucasDeadlinesFor(course({ studyMode: "Part-time" }))).toEqual([]);
  });
});
