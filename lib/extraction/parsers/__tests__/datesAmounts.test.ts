import { describe, expect, it } from "vitest";
import { findDates, parseDaadApplicationPeriods, parseDeadlineText, resolveDate, rollForward } from "../dates";
import { parseNumber, parseScholarshipAmount, sectionText } from "../amounts";

const fetched = new Date("2026-09-07T15:11:22Z");
const day = (iso: string) => iso.slice(0, 10);

describe("findDates and resolveDate", () => {
  it("reads day-month, month-day and explicit years", () => {
    expect(findDates("until 15 July").map((d) => [d.day, d.month, d.year])).toEqual([[15, 6, null]]);
    expect(findDates("1 April - 15 May").map((d) => d.day)).toEqual([1, 15]);
    expect(findDates("closes July 15, 2027")[0]).toMatchObject({ day: 15, month: 6, year: 2027 });
    expect(findDates("1st March 2026")[0]).toMatchObject({ day: 1, month: 2, year: 2026 });
    expect(findDates("31 February")).toEqual([]);
  });
  it("resolves an annual date to its next occurrence", () => {
    expect(day(resolveDate({ day: 15, month: 6, year: null }, fetched).toISOString())).toBe("2027-07-15");
    expect(day(resolveDate({ day: 15, month: 8, year: null }, fetched).toISOString())).toBe("2026-09-15");
    expect(day(resolveDate({ day: 15, month: 0, year: 2026 }, fetched).toISOString())).toBe("2026-01-15");
  });
  it("rolls annual dates forward but never dated ones", () => {
    const now = new Date("2026-11-11T10:00:00Z");
    expect(day(rollForward(new Date("2026-09-15T00:00:00Z"), "until 15 September", now).toISOString())).toBe("2027-09-15");
    expect(day(rollForward(new Date("2026-04-01T00:00:00Z"), "from 20 February to 1 April 2026", now).toISOString())).toBe("2026-04-01");
  });
});

describe("DAAD application periods", () => {
  const page = (block: string) => `Beginning\n    Winter semester \n\nApplication periods \n${block}\nMore information on application periods\n     Please find more details`;

  it("reads one group and semester", () => {
    const r = parseDaadApplicationPeriods(
      page("     The following is valid for applicants from: all countries   \nFor the winter semester:   \nuntil 15 May  \n"),
      fetched,
    );
    expect(r.deadlines).toEqual([
      { date: "2027-05-15T00:00:00.000Z", dateText: "until 15 May", intake: "Winter semester", sourceQuote: "until 15 May" },
    ]);
  });

  it("keeps applicant groups apart and takes a range's end", () => {
    const r = parseDaadApplicationPeriods(
      page(
        [
          "     The following is valid for applicants from: non-EU countries",
          "For the winter semester:",
          "1 April - 15 May",
          "For the summer semester:",
          "1 October - 15 November",
          "* * *",
          "     The following is valid for applicants from:",
          "  * EU countries",
          "  * Iceland",
          "  * Norway",
          "For the winter semester:",
          "until 15 July",
        ].join("\n"),
      ),
      fetched,
    );
    expect(r.deadlines.map((d) => [d.intake, day(d.date), d.dateText])).toEqual([
      ["Winter semester (non-EU applicants)", "2027-05-15", "1 April - 15 May"],
      ["Summer semester (non-EU applicants)", "2026-11-15", "1 October - 15 November"],
      ["Winter semester (EU applicants)", "2027-07-15", "until 15 July"],
    ]);
  });

  it("reads group and semester from the line in free-form blocks", () => {
    const md = [
      "Application periods",
      "  * **All applicants for the scholarship programme (EU and non-EU applicants):** 1 December (for the winter semester in the following year)",
      "  * **Non-EU applicants:** 1 May (for the upcoming winter semester)",
      "  * **EU applicants (EU natives and students with an EU degree):** 1 July (for the upcoming winter semester)",
      "More information on application periods",
    ].join("\n");
    const r = parseDaadApplicationPeriods(md, new Date("2026-09-06T00:00:00Z"));
    expect(r.deadlines.map((d) => [day(d.date), d.intake])).toEqual([
      ["2026-12-01", "Winter semester"],
      ["2027-05-01", "Winter semester (non-EU applicants)"],
      ["2027-07-01", "Winter semester (EU applicants)"],
    ]);
    expect(r.deadlines[1].dateText).toBe("Non-EU applicants: 1 May (for the upcoming winter semester)");
  });
  it("notes when no deadline is listed and stops at the next field", () => {
    const r = parseDaadApplicationPeriods(page("     This programme has no deadline listed.\nCombined Master's degree / PhD programme\n     No"), fetched);
    expect(r).toMatchObject({ found: true, deadlines: [], note: "This programme has no deadline listed." });
  });
});

describe("free-text deadlines", () => {
  const asOf = new Date("2026-11-11T00:00:00Z");
  it("reads semester deadlines and annual dates", () => {
    const r = parseDeadlineText("The deadline for application is 1 March for the summer semester and 15 September for the winter semester.", asOf);
    expect(r.map((d) => [day(d.date), d.intake])).toEqual([
      ["2027-03-01", "Summer semester"],
      ["2027-09-15", "Winter semester"],
    ]);
  });
  it("skips the opening date of a window and nomination deadlines", () => {
    expect(parseDeadlineText("Applications can be submitted from 20 February to 1 April 2026.", asOf).map((d) => day(d.date))).toEqual(["2026-04-01"]);
    expect(
      parseDeadlineText("The nomination deadline is annually on 1 December. The application deadline is annually on 1 January.", asOf).map((d) => day(d.date)),
    ).toEqual(["2027-01-01"]);
  });

  // The cases below are real DAAD scholarship wording.
  const days = (text: string) => parseDeadlineText(text, asOf).map((d) => day(d.date));
  it("skips dates that open applications", () => {
    expect(days("31 July of each year, 23:59 (Central European Time). Applications are possible from 01 June each year")).toEqual(["2027-07-31"]);
    expect(days("2 April 2026 You can apply from 3 February 2026 onwards.")).toEqual(["2026-04-02"]);
    expect(days("The application occurs online through the DAAD Portal in the period between 4 November and 4 December.")).toEqual(["2026-12-04"]);
    expect(
      days("Beginning of Application: 1st August 2026 Deadline: 30th August 2026 Selection: September 2026 Beginning of Funding: 1st October 2026"),
    ).toEqual(["2026-08-30"]);
  });
  it("skips programme starts, admission dates and funding periods", () => {
    expect(
      days(
        "Application deadlines are: 1 September for the following summer semester (programme start 1 April) 1 March for the following winter semester (programme start 1 October)",
      ),
    ).toEqual(["2027-09-01", "2027-03-01"]);
    expect(
      days("Deadlines for scholarship application are 31 March for admission on 1 October of the same year and 30 September for admission on 1 April"),
    ).toEqual(["2027-03-31", "2027-09-30"]);
    expect(days("15 April (for the funding period: 1 October to 30 September of the following year)")).toEqual(["2027-04-15"]);
  });
  it("keeps the end of each application window", () => {
    expect(
      days(
        "Application periods: 1 October to 15 January (midnight) for funding beginning in the following winter semester 1 April to 15 July (midnight) for funding beginning in the following summer semester",
      ),
    ).toEqual(["2027-01-15", "2027-07-15"]);
    expect(days("9th October for visits beginning between April and September of the following year 8th April for visits beginning between October and March")).toEqual([
      "2027-10-09",
      "2027-04-08",
    ]);
  });
  it("reads German numeric dates and EU / non-EU groups", () => {
    expect(days("01.10.2026 You can apply from 3rd September 2026.")).toEqual(["2026-10-01"]);
    const rwth = parseDeadlineText("Please make sure to submit all required documents at the latest by 1 March (non-EU citizens) or 15 July (EU citizens).", asOf);
    expect(rwth.map((d) => [day(d.date), d.intake])).toEqual([
      ["2027-03-01", "(non-EU applicants)"],
      ["2027-07-15", "(EU applicants)"],
    ]);
  });
});

describe("amounts", () => {
  it("parses English, German and Turkish number formats", () => {
    expect(parseNumber("1,300")).toBe(1300);
    expect(parseNumber("1.200,00")).toBe(1200);
    expect(parseNumber("9.500")).toBe(9500);
    expect(parseNumber("144,000")).toBe(144000);
  });
  it("finds the monthly stipend and its period", () => {
    expect(parseScholarshipAmount("  * A monthly payment of 992 euros\n  * One-off study allowance")).toMatchObject({ amount: 992, currency: "EUR", period: "MONTH" });
    expect(parseScholarshipAmount("Scholarship payments of 1,300 euros a month")).toMatchObject({ amount: 1300, currency: "EUR", period: "MONTH" });
    expect(parseScholarshipAmount("* Stipend of £1,347 per month\n* Stipend of £1,347 per month (paid quarterly)")).toMatchObject({ amount: 1347 });
  });
  it("keeps a monthly stipend beside a one-off payment", () => {
    expect(parseScholarshipAmount("* A monthly payment of 992 euros\n* A one-off study allowance of 460 euros")).toMatchObject({ amount: 992, period: "MONTH" });
  });
  it("gives no amount when the page lists several rates, since no one figure is true for everyone", () => {
    expect(parseScholarshipAmount("Monthly Stipend: Undergraduate: 4.500 TL, Master's: 6.500 TL, PhD: 9.000 TL")).toBeNull();
    expect(
      parseScholarshipAmount("* Stipend (living allowance) at the rate of £1,347 per month, or £1,652 per month for those at universities in London"),
    ).toBeNull();
    expect(parseScholarshipAmount("Graduates: 1,300 euros per month\nPost-docs: 1,600 euros per month")).toBeNull();
  });
  it("reads a tier list split over lines under one bullet (DAAD layouts)", () => {
    const rise = [
      "  * A monthly scholarship of  ",
      "- 992 Euros for undergraduate and Master’s students   ",
      "- 1,300 Euros for PhD students  ",
      "(The internship providers contribute 500 Euros of this monthly rate)",
      "  * health-, accident and private liability insurance",
    ].join("\n");
    expect(parseScholarshipAmount(rise)).toBeNull();
    const staff = "  * Monthly payments of  \n2,000 euros for assistant teachers, assistant professors and lecturers,  \n2,150 euros for professors\n  * Travel allowance";
    expect(parseScholarshipAmount(staff)).toBeNull();
    expect(parseScholarshipAmount("* monthly **scholarship payments** of 1.400 euros for doctoral candidates and postdocs, 2.000 euros for assistant professors")).toBeNull();
  });
  it("takes the period named closest to the figure", () => {
    expect(parseScholarshipAmount("* A monthly payment of 992 euros and a one-off allowance of 460 euros")).toMatchObject({ amount: 992, period: "MONTH" });
  });
  it("ignores comparison tables, conditions and cost estimates", () => {
    expect(parseScholarshipAmount("| Area | Average Rent (Yen) |\n| --- | --- |\n| National average | 41,000 |")).toBeNull();
    expect(
      parseScholarshipAmount("* For individuals receiving scholarships outside of this program, the total monthly amount of the scholarship must not exceed 80,000 yen"),
    ).toBeNull();
    expect(parseScholarshipAmount("Scholarship benefits: 48,000 yen/month (changes may occur each school year)")).toMatchObject({
      amount: 48000,
      currency: "JPY",
      period: "MONTH",
    });
  });
  it("ignores figures that are not the award", () => {
    expect(parseScholarshipAmount("* Up to £3,000 for approved project-related expenses")).toBeNull();
    expect(parseScholarshipAmount("cash funds of at least £20,000 available")).toBeNull();
    expect(parseScholarshipAmount("It is possible to earn 1,000 yen per hour working part-time")).toBeNull();
  });
  it("finds a markdown section", () => {
    expect(sectionText("### Value\n  * A monthly payment of 992 euros\n### Duration\n x", /^Value$/)).toBe("* A monthly payment of 992 euros");
  });
});
