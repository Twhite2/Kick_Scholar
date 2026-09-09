import { describe, it, expect } from "vitest";
import { deriveRules, isLinkable, type EligibilityRow } from "../rules";
import { linkConfidence, linkDedupeKey } from "../inferApplicableLinks";

/**
 * These cases are taken from values that are actually in the database, not
 * invented ones — "Germany", "EU", "ANY", the all-nine-categories list and the
 * free-text subject names all appear in real extracted rows. The point of the
 * rules layer is to survive them, so that is what is tested.
 */
const row = (
  criterionType: EligibilityRow["criterionType"],
  valueList: string[],
): EligibilityRow => ({ criterionType, valueList });

describe("deriveRules — country normalisation", () => {
  it("keeps ISO alpha-2 codes as they are", () => {
    expect(deriveRules([row("COUNTRY_OF_STUDY", ["DE", "CH"])]).countries).toEqual(["CH", "DE"]);
  });

  it("resolves country names the extractor emitted instead of codes", () => {
    expect(deriveRules([row("COUNTRY_OF_STUDY", ["Germany"])]).countries).toEqual(["DE"]);
  });

  it("expands EU to its member states", () => {
    const rules = deriveRules([row("COUNTRY_OF_STUDY", ["EU"])]);
    expect(rules.countries).toContain("FR");
    expect(rules.countries).toContain("DE");
    expect(rules.countries).toHaveLength(27);
  });

  it("reports a region it cannot resolve instead of silently dropping it", () => {
    const rules = deriveRules([row("COUNTRY_OF_STUDY", ["DE", "Latin America"])]);
    expect(rules.countries).toEqual(["DE"]);
    expect(rules.unresolved).toContain("Latin America");
  });
});

describe("deriveRules — non-constraints", () => {
  it('treats "ANY" as no field restriction rather than a category', () => {
    const rules = deriveRules([row("FIELD_OF_STUDY", ["ANY"])]);
    expect(rules.fieldCategories).toEqual([]);
    expect(rules.unresolved).toEqual([]);
  });

  it("drops a field list naming every category — it restricts nothing", () => {
    const all = [
      "STEM", "BUSINESS", "HUMANITIES", "SOCIAL_SCIENCES", "ARTS",
      "HEALTH", "LAW", "EDUCATION", "OTHER",
    ];
    expect(deriveRules([row("FIELD_OF_STUDY", all)]).fieldCategories).toEqual([]);
  });

  it("reports a free-text subject the enum cannot express", () => {
    const rules = deriveRules([row("FIELD_OF_STUDY", ["computer science"])]);
    expect(rules.fieldCategories).toEqual([]);
    expect(rules.unresolved).toEqual(["computer science"]);
  });

  it("records institution types without turning them into a filter", () => {
    // University.type is null for 991 of 993 catalogue rows, so filtering on
    // this would delete every link for the scholarships that state one.
    const rules = deriveRules([row("UNIVERSITY", ["STATE_RECOGNISED"])]);
    expect(rules.institutionTypes).toEqual(["STATE_RECOGNISED"]);
    expect(isLinkable(rules)).toBe(false);
  });
});

describe("isLinkable", () => {
  it("refuses a degree level on its own — it is true of nearly everything", () => {
    expect(isLinkable(deriveRules([row("DEGREE_LEVEL", ["MASTER"])]))).toBe(false);
  });

  it("accepts a country bound", () => {
    expect(isLinkable(deriveRules([row("COUNTRY_OF_STUDY", ["DE"])]))).toBe(true);
  });

  it("accepts a subject bound with no country", () => {
    expect(isLinkable(deriveRules([row("FIELD_OF_STUDY", ["STEM"])]))).toBe(true);
  });
});

describe("linkConfidence", () => {
  const rules = (over: Partial<ReturnType<typeof deriveRules>> = {}) => ({
    countries: [], degreeLevels: [], fieldCategories: [],
    institutionTypes: [], unresolved: [], ...over,
  });

  it("never reaches certainty — inference is not a stated fact", () => {
    const everything = rules({
      countries: ["DE"], degreeLevels: ["MASTER"], fieldCategories: ["STEM"],
    });
    expect(linkConfidence(everything, "PROGRAM")).toBeLessThanOrEqual(0.85);
  });

  it("scores a narrower rule set above a broader one", () => {
    const broad = rules({ countries: ["DE"] });
    const narrow = rules({ countries: ["DE"], degreeLevels: ["MASTER"], fieldCategories: ["STEM"] });
    expect(linkConfidence(narrow, "PROGRAM")).toBeGreaterThan(linkConfidence(broad, "UNIVERSITY"));
  });
});

describe("linkDedupeKey", () => {
  it("is stable and distinguishes a university-only link from a programme one", () => {
    expect(linkDedupeKey("s1", "u1", null)).toBe("s1:u:u1:p:-");
    expect(linkDedupeKey("s1", "u1", "p1")).toBe("s1:u:u1:p:p1");
    expect(linkDedupeKey("s1", "u1", null)).not.toBe(linkDedupeKey("s1", "u1", "p1"));
  });
});

describe("linkConfidence — fallback honesty", () => {
  const rules = {
    countries: ["DE"], degreeLevels: ["MASTER"], fieldCategories: ["STEM"],
    institutionTypes: [], unresolved: [],
  };

  it("does not credit degree/field rules that never narrowed the set", () => {
    // The country-only fallback: the catalogue had no matching programme, so
    // location alone produced these links and the score must say so.
    const applied = linkConfidence(rules, "UNIVERSITY", true);
    const notApplied = linkConfidence(rules, "UNIVERSITY", false);
    expect(notApplied).toBeLessThan(applied);
    expect(notApplied).toBe(0.5);
  });
});
