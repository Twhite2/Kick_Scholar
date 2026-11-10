import { describe, expect, it } from "vitest";
import {
  parseProgrammeParams,
  parseScholarshipParams,
  parseUniversityParams,
  programmeOrderBy,
  programmeWhere,
  scholarshipWhere,
  universityOrderBy,
  universityWhere,
  withParam,
} from "../params";

/**
 * Old catalogue URLs must filter exactly as they did before the remodel. The
 * expected objects below are the where-clauses the pre-remodel pages built
 * inline for the same query strings.
 */
const parse = (qs: string) => Object.fromEntries(new URLSearchParams(qs));

describe("programme URLs keep their meaning", () => {
  it("?q=computer&country=DE&degree=MASTER&field=STEM&tuition=FREE&page=2", () => {
    const f = parseProgrammeParams(parse("q=computer&country=DE&degree=MASTER&field=STEM&tuition=FREE&page=2"));
    expect(programmeWhere(f)).toEqual({
      OR: [
        { name: { contains: "computer", mode: "insensitive" } },
        { university: { name: { contains: "computer", mode: "insensitive" } } },
      ],
      university: { country: "DE" },
      degreeLevel: "MASTER",
      fieldCategory: "STEM",
      tuitionType: "FREE",
    });
    expect(f.page).toBe(2);
    expect(f.sort).toBe("match");
  });

  it("sort=tuition orders by amount, sort=name by name, unknown sorts by name", () => {
    expect(programmeOrderBy(parseProgrammeParams(parse("sort=tuition")).sort)).toEqual({ tuitionAmount: "asc" });
    expect(programmeOrderBy(parseProgrammeParams(parse("sort=name")).sort)).toEqual({ name: "asc" });
    expect(parseProgrammeParams(parse("sort=whatever")).sort).toBe("name");
  });

  it("sort=best is an alias of the default best-match order", () => {
    expect(parseProgrammeParams(parse("sort=best&qualify=1"))).toMatchObject({ sort: "match", qualify: true });
  });

  it("bad page numbers fall back to page 1", () => {
    expect(parseProgrammeParams(parse("page=-3")).page).toBe(1);
    expect(parseProgrammeParams(parse("page=abc")).page).toBe(1);
    expect(parseProgrammeParams(parse("page=4.7")).page).toBe(4);
  });

  it("no filters means no where clause", () => {
    expect(programmeWhere(parseProgrammeParams({}))).toEqual({});
  });
});

describe("scholarship URLs keep their meaning", () => {
  it("?country=DE&coverage=FULL_FUNDING&verified=true", () => {
    expect(scholarshipWhere(parseScholarshipParams(parse("country=DE&coverage=FULL_FUNDING&verified=true")))).toEqual({
      country: "DE",
      coverageType: "FULL_FUNDING",
      verified: true,
    });
  });
  it("verified=false is not a filter (as before)", () => {
    expect(scholarshipWhere(parseScholarshipParams(parse("verified=false")))).toEqual({});
  });
  it("?q=daad searches name and provider", () => {
    expect(scholarshipWhere(parseScholarshipParams(parse("q=daad")))).toEqual({
      OR: [
        { name: { contains: "daad", mode: "insensitive" } },
        { providerName: { contains: "daad", mode: "insensitive" } },
      ],
    });
  });
});

describe("university URLs keep their meaning", () => {
  it("?q=berlin&country=DE&has=programs&sort=programs", () => {
    const f = parseUniversityParams(parse("q=berlin&country=DE&has=programs&sort=programs"));
    expect(universityWhere(f)).toEqual({
      OR: [
        { name: { contains: "berlin", mode: "insensitive" } },
        { city: { contains: "berlin", mode: "insensitive" } },
      ],
      country: "DE",
      programs: { some: {} },
    });
    expect(universityOrderBy(f.sort)).toEqual({ programs: { _count: "desc" } });
  });
  it("defaults to most scholarships first", () => {
    expect(universityOrderBy(parseUniversityParams({}).sort)).toEqual({ fundingOpportunities: { _count: "desc" } });
    expect(universityWhere(parseUniversityParams(parse("has=scholarships")))).toEqual({ fundingOpportunities: { some: {} } });
  });
});

describe("withParam", () => {
  it("changes one key and drops page and focus", () => {
    expect(withParam({ q: "ai", page: "3", focus: "search" }, "country", "DE")).toBe("?q=ai&country=DE");
    expect(withParam({ q: "ai", country: "DE" }, "country", null)).toBe("?q=ai");
  });
});
