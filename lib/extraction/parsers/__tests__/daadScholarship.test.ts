import { describe, it, expect, beforeAll } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { daadScholarshipParser } from "../daadScholarship";
import { ExtractionFileSchema } from "../../schemas";
import type { SourceDocumentInput } from "../../types";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const URL =
  "https://www2.daad.de/deutschland/stipendium/datenbank/en/21148-scholarship-database/?detail=10000092";

let doc: SourceDocumentInput;

beforeAll(async () => {
  // A real crawled page, not a hand-written approximation — so the test
  // fails if DAAD changes its template.
  const markdown = await readFile(
    path.join(HERE, "fixtures", "daad-scholarship-10000092.md"),
    "utf-8",
  );
  doc = {
    sourceDocumentId: "src-daad:test",
    sourceId: "src-daad",
    url: URL,
    markdown,
  };
});

describe("DaadScholarshipParser", () => {
  it("only claims DAAD scholarship detail pages", () => {
    expect(daadScholarshipParser.matches(doc)).toBe(true);
    expect(
      daadScholarshipParser.matches({ ...doc, url: "https://example.com/x" }),
    ).toBe(false);
    // The listing page shares the path but has no detail= parameter.
    expect(
      daadScholarshipParser.matches({
        ...doc,
        url: "https://www2.daad.de/deutschland/stipendium/datenbank/en/21148-scholarship-database/",
      }),
    ).toBe(false);
  });

  it("produces output that satisfies the real extraction schema", () => {
    const result = daadScholarshipParser.parse(doc)!;
    expect(result).not.toBeNull();
    const parsed = ExtractionFileSchema.safeParse(result.extraction);
    if (!parsed.success) {
      throw new Error(
        parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n"),
      );
    }
    expect(parsed.success).toBe(true);
  });

  it("extracts the programme title from the H2, not the cookie banner", () => {
    const s = daadScholarshipParser.parse(doc)!.extraction.scholarships[0];
    expect(s.name).toBe("Prussian Cultural Heritage Foundation: Grant Programme");
    expect(s.name).not.toMatch(/cookie/i);
  });

  it("keeps a prose deadline as deadlineText and never invents a date", () => {
    const s = daadScholarshipParser.parse(doc)!.extraction.scholarships[0];
    expect(s.deadlineText).toMatch(/deadlines differ/i);
    // The page states no concrete date, so no deadline record may claim one.
    expect(s.deadlines).toEqual([]);
  });

  it("recognises a recurring monthly award as a STIPEND", () => {
    const s = daadScholarshipParser.parse(doc)!.extraction.scholarships[0];
    expect(s.coverageType).toBe("STIPEND");
  });

  it("refuses to pick a headline amount when the page lists several tiers", () => {
    const { extraction, coverage } = daadScholarshipParser.parse(doc)!;
    // The page quotes 1,300 EUR, 1,600 EUR and a 500 EUR travel allowance —
    // choosing one would fabricate a figure the source never states.
    expect(extraction.scholarships[0].amount).toBeNull();
    expect(coverage.unfilled).toContain("scholarships[0].amount");
  });

  it("reports prose eligibility as needing interpretation rather than guessing", () => {
    const { extraction, coverage } = daadScholarshipParser.parse(doc)!;
    expect(extraction.scholarships[0].eligibility).toEqual([]);
    expect(coverage.unfilled.some((u) => u.includes("DEGREE_LEVEL"))).toBe(true);
  });

  it("quotes verbatim from the source document", () => {
    const { extraction } = daadScholarshipParser.parse(doc)!;
    const quote = extraction.scholarships[0].sourceQuote;
    const normalise = (s: string) => s.replace(/\s+/g, " ").trim();
    // The core anti-hallucination invariant: the quote must literally occur
    // in the page it claims to come from.
    expect(normalise(doc.markdown)).toContain(normalise(quote));
  });

  it("returns null for a page that isn't the expected template", () => {
    expect(
      daadScholarshipParser.parse({ ...doc, markdown: "no headings here" }),
    ).toBeNull();
  });
});
