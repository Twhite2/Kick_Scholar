import { describe, expect, it } from "vitest";
import { mextScholarshipsParser, tableRows } from "../mextScholarships";
import { ExtractionFileSchema } from "../../schemas";

// The structure of MEXT's page (Study in Japan, crawled 31 Oct 2026), cut
// down to three of its seven types; the merged cells are what matter.
const HTML = `
<h3>Types and Their Status</h3>
<table>
<tr><th></th><th>Research students</th><th>Undergraduate students</th><th>Young leaders program (YLP) students (*2)</th></tr>
<tr><th>Embassy recommendation</th><td>Yes</td><td>Yes</td><td>No</td></tr>
<tr><th>University recommendation (*1)</th><td>Yes</td><td>Yes</td><td>No</td></tr>
<tr><th>Level of studies</th><td>Graduate school level</td><td>Undergraduate level</td><td>Graduate school level</td></tr>
<tr><th>Field of study</th><td>Major in field of specialty at a graduate school etc.</td><td>Undergraduate education</td><td>Master course at a graduate school</td></tr>
<tr><th>Scholarship</th><td>&yen;143,000～145,000 per month</td><td>&yen;117,000 per month</td><td>￥242,000 per month</td></tr>
<tr><th>Tuition</th><td colspan="3">Exempted</td></tr>
<tr><th>Travel allowance</th><td colspan="3">Round-trip travel expenses (airfare) provided</td></tr>
</table>
<h3>Eligibility</h3>
<table>
<tr><td>Research students</td><td>You must be under 35 years of age and be eligible for admission to a master's program.</td></tr>
<tr><td>Undergraduate students</td><td>You must be under 25 years of age and have completed 12 years of school education.</td></tr>
<tr><td>Young Leaders Program (YLP) students</td><td>You must be under 40 years of age (in principle).</td></tr>
</table>`;

const doc = {
  sourceDocumentId: "src-mext:test",
  sourceId: "src-mext",
  url: "https://www.studyinjapan.go.jp/en/planning/scholarships/mext-scholarships/",
  markdown: "",
  html: HTML,
};

describe("tableRows", () => {
  it("repeats a merged cell across the columns it spans", () => {
    expect(tableRows('<table><tr><td>a</td><td colspan="2">b</td></tr></table>')).toEqual([["a", "b", "b"]]);
  });
});

describe("mextScholarshipsParser", () => {
  const result = mextScholarshipsParser.parse(doc)!;
  const byType = (t: string) => result.extraction.scholarships.find((s) => s.name.endsWith(t))!;

  it("reads one valid record per scholarship type", () => {
    expect(mextScholarshipsParser.matches(doc)).toBe(true);
    expect(ExtractionFileSchema.safeParse(result.extraction).success).toBe(true);
    expect(result.extraction.scholarships.map((s) => s.name)).toEqual([
      "Japanese Government (MEXT) Scholarship: Research Students",
      "Japanese Government (MEXT) Scholarship: Undergraduate Students",
      "Japanese Government (MEXT) Scholarship: Young Leaders Program (YLP) Students",
    ]);
  });

  it("takes each type's own monthly amount and leaves a range unstated", () => {
    expect(byType("Research Students").amount).toBeNull();
    expect(byType("Undergraduate Students")).toMatchObject({ amount: 117000, amountCurrency: "JPY", amountPeriod: "MONTH" });
    expect(byType("(YLP) Students")).toMatchObject({ amount: 242000, amountCurrency: "JPY", amountPeriod: "MONTH" });
  });

  it("states full funding only when tuition, stipend and travel are all stated", () => {
    expect(result.extraction.scholarships.every((s) => s.coverageType === "FULL_FUNDING")).toBe(true);
  });

  it("reads the age limits and the levels the page states", () => {
    expect(byType("Research Students").eligibility[0]).toMatchObject({ criterionType: "MAX_AGE", operator: "LT", numericValue: 35 });
    expect(byType("Undergraduate Students").applicability[0].degreeLevels).toEqual(["BACHELOR"]);
    expect(byType("Research Students").applicability[0].degreeLevels).toEqual(["MASTER", "PHD"]);
    expect(byType("(YLP) Students").applicability[0].degreeLevels).toEqual(["MASTER"]);
  });
});
