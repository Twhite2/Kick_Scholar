import { describe, it, expect } from "vitest";
import {
  mapRorToUniversity,
  isHigherEducation,
  bareRorId,
} from "../mapRorToUniversity";
import { RorRecordSchema } from "../rorSchema";

/** A real record captured from api.ror.org/v2 (Aalto-shaped). */
const REAL_RECORD = RorRecordSchema.parse({
  id: "https://ror.org/020hwjq30",
  status: "active",
  types: ["education"],
  names: [
    { lang: "en", types: ["ror_display", "label"], value: "Aalto University" },
    { lang: "fi", types: ["label"], value: "Aalto-yliopisto" },
  ],
  locations: [
    {
      geonames_details: {
        country_code: "FI",
        country_name: "Finland",
        name: "Espoo",
        country_subdivision_name: "Uusimaa",
      },
    },
  ],
  links: [{ type: "website", value: "https://www.aalto.fi/" }],
  domains: ["aalto.fi"],
  established: 2010,
  external_ids: [
    { type: "wikidata", preferred: "Q1049643", all: ["Q1049643"] },
    { type: "grid", preferred: "grid.5373.2", all: ["grid.5373.2"] },
  ],
});

describe("bareRorId", () => {
  it("strips the ror.org URL prefix", () => {
    expect(bareRorId("https://ror.org/05pb4em20")).toBe("05pb4em20");
    expect(bareRorId("05pb4em20")).toBe("05pb4em20");
  });
});

describe("mapRorToUniversity", () => {
  it("maps a real ROR record onto University fields", () => {
    const r = mapRorToUniversity(REAL_RECORD);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.university).toMatchObject({
      rorId: "020hwjq30",
      name: "Aalto University",
      country: "FI",
      city: "Espoo",
      region: "Uusimaa",
      foundedYear: 2010,
      wikidataId: "Q1049643",
    });
    // Reuses the shared dedupe helper so ROR rows collide with crawled ones.
    expect(r.university.dedupeKey).toBe("fi-aalto-university");
    // canonicalizeUrl strips a trailing slash EXCEPT when the path is just
    // "/" (see lib/normalization/canonicalUrl.ts), so a bare domain keeps it.
    expect(r.university.website).toBe("https://www.aalto.fi/");
  });

  it("prefers the ror_display name over other labels", () => {
    const r = mapRorToUniversity(REAL_RECORD);
    expect(r.ok && r.university.name).toBe("Aalto University");
  });

  it("skips a record with no website rather than inventing one", () => {
    const record = RorRecordSchema.parse({
      ...REAL_RECORD,
      links: [],
      domains: [],
    });
    const r = mapRorToUniversity(record);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("no-website");
  });

  it("skips inactive and non-education records", () => {
    const inactive = mapRorToUniversity(
      RorRecordSchema.parse({ ...REAL_RECORD, status: "inactive" }),
    );
    expect(inactive.ok).toBe(false);

    const company = mapRorToUniversity(
      RorRecordSchema.parse({ ...REAL_RECORD, types: ["company"] }),
    );
    expect(company.ok).toBe(false);
  });

  it("never guesses PUBLIC/PRIVATE — ROR does not carry it", () => {
    const r = mapRorToUniversity(REAL_RECORD);
    expect(r.ok && "type" in r.university).toBe(false);
  });
});

describe("isHigherEducation (Wikidata P31 vetting)", () => {
  it("accepts a plain university", () => {
    // Hochschule Anhalt: higher education institution + public university.
    expect(isHigherEducation(["Q38723", "Q875538", "Q1365560"])).toBe(true);
  });

  it("accepts an institution that is ALSO a research institute", () => {
    // Hertie School is genuinely classified as both a research institute
    // (Q31855) and a private university (Q902104). An exclusion-based rule
    // would wrongly delete it — the rule must be "has a higher-ed class".
    expect(isHigherEducation(["Q963908", "Q31855", "Q902104", "Q43229"])).toBe(true);
  });

  it("rejects a pure research institute", () => {
    expect(isHigherEducation(["Q31855"])).toBe(false);
  });

  it("rejects a secondary school", () => {
    // Q9826 high school, Q159334 secondary school.
    expect(isHigherEducation(["Q9826"])).toBe(false);
    expect(isHigherEducation(["Q159334"])).toBe(false);
  });

  it("rejects an empty classification rather than defaulting to accept", () => {
    expect(isHigherEducation([])).toBe(false);
  });
});
