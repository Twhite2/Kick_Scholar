import { describe, expect, it } from "vitest";
import { applicantGroupFor, deadlineAppliesTo, deadlineWhereFor, intakeLabel } from "../applicant-group";
import { formatStudyLength } from "@/lib/ui/format";
import { posterAmount } from "@/lib/ui/coverage";

describe("applicantGroupFor", () => {
  it("reads the en-GB country names the profile stores", () => {
    expect(applicantGroupFor("Nigeria")).toBe("NON_EU");
    expect(applicantGroupFor("Germany")).toBe("EU");
    expect(applicantGroupFor("Norway")).toBe("EU");
    expect(applicantGroupFor("Switzerland")).toBe("EU");
    expect(applicantGroupFor("United Kingdom")).toBe("NON_EU");
    expect(applicantGroupFor("czech republic")).toBe("EU");
  });
  it("accepts codes and knows nothing without a nationality", () => {
    expect(applicantGroupFor("FR")).toBe("EU");
    expect(applicantGroupFor("gh")).toBe("NON_EU");
    expect(applicantGroupFor(null)).toBeNull();
    expect(applicantGroupFor("  ")).toBeNull();
  });
});

describe("deadlineAppliesTo", () => {
  it("hides the other group's dates", () => {
    expect(deadlineAppliesTo("Winter semester (EU applicants)", "NON_EU")).toBe(false);
    expect(deadlineAppliesTo("Winter semester (non-EU applicants)", "NON_EU")).toBe(true);
    expect(deadlineAppliesTo("Winter semester (non-EU applicants)", "EU")).toBe(false);
    expect(deadlineAppliesTo("(EU applicants)", "EU")).toBe(true);
  });
  it("keeps dates for everyone, and every date when the group is unknown", () => {
    expect(deadlineAppliesTo("Winter semester", "NON_EU")).toBe(true);
    expect(deadlineAppliesTo(null, "EU")).toBe(true);
    expect(deadlineAppliesTo("Summer semester (EU applicants)", null)).toBe(true);
  });
  it("builds the same rule for Prisma, keeping null intakes", () => {
    expect(deadlineWhereFor(null)).toEqual({});
    expect(deadlineWhereFor("NON_EU")).toEqual({ OR: [{ intake: null }, { NOT: { intake: { contains: "(EU applicants)" } } }] });
  });
});

describe("intakeLabel", () => {
  it("drops the nested brackets for display", () => {
    expect(intakeLabel("Winter semester (non-EU applicants)")).toBe("Winter semester, non-EU applicants");
    expect(intakeLabel("(EU applicants)")).toBe("EU applicants");
    expect(intakeLabel("Summer semester")).toBe("Summer semester");
    expect(intakeLabel(null)).toBeNull();
  });
});

describe("formatStudyLength", () => {
  it("joins length and mode", () => {
    expect(formatStudyLength(24, "Full-time")).toBe("2 years, full-time");
    expect(formatStudyLength(12, "Full-time or part-time")).toBe("1 year full-time, part-time available");
    expect(formatStudyLength(12, "Full-time or part-time", { short: true })).toBe("1 year, full or part-time");
    expect(formatStudyLength(36, "Part-time")).toBe("3 years, part-time");
  });
  it("shows whichever half is known", () => {
    expect(formatStudyLength(null, "Part-time")).toBe("Part-time");
    expect(formatStudyLength(18, null)).toBe("18 months");
    expect(formatStudyLength(null, null)).toBeNull();
  });
});

describe("posterAmount per-line", () => {
  it("says how often a stated amount is paid", () => {
    expect(posterAmount({ coverage: "STIPEND", amount: 992, currency: "EUR", per: "month" })).toMatchObject({ per: "a month", confirmed: true });
    expect(posterAmount({ coverage: "UNKNOWN", amount: 475, currency: "EUR", per: "once" })).toMatchObject({ per: "one-off" });
    expect(posterAmount({ coverage: "STIPEND", amount: 992, currency: "EUR" })).toMatchObject({ per: null });
  });
});
