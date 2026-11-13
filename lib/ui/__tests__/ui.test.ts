import { describe, expect, it } from "vitest";
import { hash32, monogramColor, monogramText, MONOGRAM_PALETTE } from "../monogram";
import { countryName, countryTint, destinationScene, sceneFor, isCountryCode } from "../country";
import {
  applicationsCloseLine,
  closesIn,
  daysUntil,
  formatDate,
  formatDuration,
  formatMoney,
  formatTicketDate,
  isUrgent,
  plural,
  sinceLabel,
  ticketCountdown,
} from "../format";
import { STRENGTH_ACCENT, STRENGTH_LABEL, dialLabel, isTopStrength } from "../strength";
import { COVERAGE_LABEL, POSTER_BAND_BG, amountFontSize, posterAmount, posterBand } from "../coverage";
import { blockerAction, blockerOf, unlockCopy } from "../blockers";
import { projectScore } from "@/lib/matching/project";
import type { FactorScore } from "@/lib/matching/types";

describe("monogramText", () => {
  it.each([
    ["University of Helsinki", null, "UH"],
    ["University College Dublin", null, "UCD"],
    ["KU Leuven", null, "KL"],
    ["RWTH Aachen University", "RWTH", "RWTH"],
    ["Université Paris-Saclay", null, "UPS"],
    ["Universität Hamburg", null, "UH"],
  ])("%s -> %s", (name, acronym, expected) => {
    expect(monogramText(name, acronym)).toBe(expected);
  });

  it("ignores acronyms that are too long or too short", () => {
    expect(monogramText("Delft University of Technology", "TUDELFTX")).toBe("DUT");
    expect(monogramText("Lund University", "L")).toBe("LU");
  });

  it("skips punctuation at the start of a word", () => {
    expect(monogramText("DAAD (German Academic Exchange Service)")).toBe("DGA");
  });

  it("falls back to the first two characters when every word is a stop word", () => {
    expect(monogramText("of the")).toBe("OF");
  });
});

describe("monogram colour", () => {
  it("is stable for the same seed", () => {
    expect(monogramColor("inst_123")).toBe(monogramColor("inst_123"));
    expect(hash32("inst_123")).toBe(hash32("inst_123"));
  });
  it("always comes from the palette", () => {
    for (const seed of ["a", "b", "clx9f0", "University of Helsinki"]) {
      expect(MONOGRAM_PALETTE).toContain(monogramColor(seed));
    }
  });
});

describe("countries", () => {
  it("prints names, not codes", () => {
    expect(countryName("DE")).toBe("Germany");
    expect(countryName("gb")).toBe("United Kingdom");
    expect(countryName("NG")).toBe("Nigeria");
  });
  it("falls back to the input for non-codes", () => {
    expect(countryName("Multiple countries")).toBe("Multiple countries");
    expect(isCountryCode("XX")).toBe(false);
    expect(isCountryCode("FI")).toBe(true);
  });
  it("tints and scenes follow Appendix B", () => {
    expect(countryTint("FI")).toBe("#10304F");
    expect(countryTint("NL")).toBe("#A54A33");
    expect(countryTint("JP")).toBe("#3A4A5E");
    expect(destinationScene("SE")).toBe("harbour");
    expect(["modern", "gothic"]).toContain(sceneFor("DE", "any-id"));
    expect(sceneFor("FI", "x")).toBe("nordic");
  });
});

describe("dates and countdowns (Africa/Lagos)", () => {
  const now = new Date("2026-11-10T09:00:00Z");

  it("counts calendar days", () => {
    expect(daysUntil(new Date("2026-11-22T00:00:00Z"), now)).toBe(12);
    expect(daysUntil(new Date("2027-01-02T00:00:00Z"), now)).toBe(53);
  });

  it("uses the Lagos date, not UTC, at the day boundary", () => {
    // 23:30 UTC on the 10th is already 00:30 on the 11th in Lagos.
    const lateNight = new Date("2026-11-10T23:30:00Z");
    expect(daysUntil(new Date("2026-11-11T00:00:00Z"), lateNight)).toBe(0);
    expect(closesIn(0)).toBe("Closes today");
    expect(closesIn(1)).toBe("Closes tomorrow");
    expect(closesIn(53)).toBe("Closes in 53 days");
  });

  it("formats dates the British way", () => {
    expect(formatDate(new Date("2026-11-22T00:00:00Z"), now)).toBe("22 Nov");
    expect(formatDate(new Date("2027-01-02T00:00:00Z"), now)).toBe("2 Jan 2027");
    expect(formatTicketDate(new Date("2026-11-22T00:00:00Z"))).toBe("Sun 22 Nov");
  });

  it("writes the billboard deadline line", () => {
    expect(applicationsCloseLine(new Date("2027-01-02T00:00:00Z"), now)).toBe(
      "Applications close 2 Jan 2027, in 53 days",
    );
    expect(applicationsCloseLine(new Date("2026-11-11T00:00:00Z"), now)).toBe("Applications close tomorrow");
    expect(applicationsCloseLine(new Date("2026-11-10T00:00:00Z"), now)).toBe("Applications close today");
    expect(applicationsCloseLine(null, now)).toBe("Deadline not published yet");
  });

  it("ticket stubs", () => {
    expect(ticketCountdown(12)).toEqual({ value: "12", label: "days left" });
    expect(ticketCountdown(1)).toEqual({ value: "1", label: "day left" });
    expect(ticketCountdown(0)).toEqual({ value: "Today", label: null });
  });

  it("marks 14 days or fewer as urgent", () => {
    expect(isUrgent(14)).toBe(true);
    expect(isUrgent(15)).toBe(false);
    expect(isUrgent(null)).toBe(false);
  });

  it("labels the previous visit", () => {
    const friday = new Date("2026-11-06T10:00:00Z");
    expect(sinceLabel(friday, now)).toBe("since Friday");
    expect(sinceLabel(new Date("2026-11-02T10:00:00Z"), now)).toBe("since 2 Nov");
  });
});

describe("money, counts and durations", () => {
  it("formats currencies", () => {
    expect(formatMoney(1400, "EUR")).toBe("€1,400");
    expect(formatMoney(12000, "SEK")).toBe("SEK 12,000");
    expect(formatMoney(450000, "NGN")).toBe("₦450,000");
    expect(formatMoney(9250.5, "GBP")).toBe("£9,251");
  });
  it("pluralises with thousands separators", () => {
    expect(plural(1, "programme")).toBe("1 programme");
    expect(plural(1412, "programme")).toBe("1,412 programmes");
    expect(plural(2, "opportunity", "opportunities")).toBe("2 opportunities");
  });
  it("prints whole years when divisible by 12", () => {
    expect(formatDuration(24)).toBe("2 years");
    expect(formatDuration(12)).toBe("1 year");
    expect(formatDuration(18)).toBe("18 months");
    expect(formatDuration(null)).toBeNull();
  });
});

describe("strength", () => {
  it("maps each strength to its accent and words", () => {
    expect(STRENGTH_ACCENT.STRONG_MATCH).toBe("var(--kick-green)");
    expect(STRENGTH_ACCENT.LIKELY_ELIGIBLE).toBe("var(--kick-green)");
    expect(STRENGTH_ACCENT.POTENTIAL_MATCH).toBe("var(--kick-blue)");
    expect(STRENGTH_ACCENT.NEEDS_VERIFICATION).toBe("var(--unverified)");
    expect(STRENGTH_ACCENT.MISSING_REQUIREMENT).toBe("var(--kick-red)");
    expect(STRENGTH_LABEL.NEEDS_VERIFICATION).toBe("Needs verification");
    expect(dialLabel(92, "STRONG_MATCH")).toBe("92 percent match, Strong match");
    expect(isTopStrength("NEEDS_VERIFICATION")).toBe(false);
  });
});

describe("coverage", () => {
  it("labels and bands", () => {
    expect(COVERAGE_LABEL.TRAVEL).toBe("Travel only");
    expect(COVERAGE_LABEL.UNKNOWN).toBe("Amount not published");
    expect(POSTER_BAND_BG[posterBand("FULL_FUNDING")]).toBe("bg-poster-full");
    expect(POSTER_BAND_BG[posterBand("PARTIAL_TUITION")]).toBe("bg-poster-tuition");
    expect(POSTER_BAND_BG[posterBand("STIPEND")]).toBe("bg-poster-other");
    expect(POSTER_BAND_BG[posterBand("UNKNOWN")]).toBe("bg-poster-other");
  });
  it("sizes the amount by its length", () => {
    expect(amountFontSize("100%")).toBe(52);
    expect(amountFontSize("€1,400")).toBe(46);
    expect(amountFontSize("SEK 12,000")).toBe(38);
    expect(amountFontSize("SEK 120,000")).toBe(30);
  });
  it("never invents an amount", () => {
    expect(posterAmount({ coverage: "FULL_TUITION", amount: null, currency: null }).text).toBe("100%");
    expect(posterAmount({ coverage: "VARIES", amount: null, currency: null }).text).toBe("To be confirmed");
    expect(posterAmount({ coverage: "FULL_FUNDING", amount: 1400, currency: "EUR" }).text).toBe("€1,400");
  });
});

const factor = (f: Partial<FactorScore> & Pick<FactorScore, "factor">): FactorScore => ({
  score: 100,
  weight: 0.1,
  explanation: "",
  ...f,
});

describe("blockers", () => {
  it("reads a missing English test", () => {
    const b = blockerOf(
      factor({
        factor: "LANGUAGE_COMPATIBILITY",
        score: 0,
        explanation: "IELTS GTE 6.5 is required — no matching score on file.",
        missingProfileData: "IELTS",
      }),
    );
    expect(b?.kind).toBe("ENGLISH_TEST_MISSING");
    expect(blockerAction(b!.kind)?.label).toBe("Add test score");
  });

  it("never offers an unlock for things a student cannot change", () => {
    expect(unlockCopy("NOT_ELIGIBLE", { programmes: 40, scholarships: 2 })).toBeNull();
    expect(unlockCopy("CGPA_BELOW_MIN", { programmes: 40, scholarships: 2 })).toBeNull();
    expect(blockerAction("CGPA_BELOW_MIN")).toBeNull();
  });

  it("writes the unlock title from the template", () => {
    expect(unlockCopy("ENGLISH_TEST_MISSING", { programmes: 23, scholarships: 4 })?.title).toBe(
      "23 more programmes open up when you add an English test score",
    );
    expect(unlockCopy("CGPA_MISSING", { programmes: 10, scholarships: 2 })?.title).toBe(
      "Add your CGPA to see 12 more matches",
    );
  });

  it("does not treat preferences as requirements", () => {
    expect(blockerOf(factor({ factor: "COUNTRY_PREFERENCE", score: 40 }))).toBeNull();
    expect(blockerOf(factor({ factor: "FIELD_COMPATIBILITY", score: 25 }))).toBeNull();
  });
});

describe("projectScore", () => {
  it("re-aggregates with one factor met and leaves the rest alone", () => {
    const scores: FactorScore[] = [
      factor({ factor: "ACADEMIC_COMPATIBILITY", score: 100, weight: 0.2 }),
      factor({ factor: "LANGUAGE_COMPATIBILITY", score: 0, weight: 0.15, missingProfileData: "IELTS" }),
      factor({ factor: "FIELD_COMPATIBILITY", score: 100, weight: 0.2 }),
      factor({ factor: "COUNTRY_PREFERENCE", score: null, weight: 0.1 }),
    ];
    // Current: (100*.2 + 0*.15 + 100*.2) / .55 = 72.7 -> 73
    expect(projectScore(scores, "LANGUAGE_COMPATIBILITY")).toBe(100);
    expect(projectScore(scores, "COUNTRY_PREFERENCE")).toBe(77);
  });
});
