import { describe, it, expect, beforeAll } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { daadProgrammeParser } from "../daadProgramme";
import { ExtractionFileSchema } from "../../schemas";
import type { SourceDocumentInput } from "../../types";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const URL =
  "https://www2.daad.de/deutschland/studienangebote/international-programmes/en/detail/3589/";

let doc: SourceDocumentInput;

beforeAll(async () => {
  // A real crawled page, so the test fails if DAAD changes its template.
  const markdown = await readFile(
    path.join(HERE, "fixtures", "daad-programme-3589.md"),
    "utf-8",
  );
  doc = {
    sourceDocumentId: "src-daad-programmes:test",
    sourceId: "src-daad-programmes",
    url: URL,
    markdown,
  };
});

describe("DaadProgrammeParser", () => {
  it("only claims programme detail pages", () => {
    expect(daadProgrammeParser.matches(doc)).toBe(true);
    expect(
      daadProgrammeParser.matches({
        ...doc,
        url: "https://www2.daad.de/deutschland/studienangebote/international-programmes/en/",
      }),
    ).toBe(false);
  });

  it("produces output satisfying the real extraction schema", () => {
    const result = daadProgrammeParser.parse(doc)!;
    const parsed = ExtractionFileSchema.safeParse(result.extraction);
    if (!parsed.success) {
      throw new Error(
        parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n"),
      );
    }
    expect(parsed.success).toBe(true);
  });

  it("extracts the programme title, not the page chrome", () => {
    // Regression: `^##\s+(?!International Programmes)` backtracks over the two
    // spaces DAAD emits, so the chrome heading was captured and EVERY
    // programme was named "International Programmes 2026/2027".
    const p = daadProgrammeParser.parse(doc)!.extraction.programs[0];
    expect(p.name).toBe("MBA in Global Management");
    expect(p.name).not.toMatch(/international programmes/i);
  });

  it("de-duplicates the doubled title DAAD renders", () => {
    const p = daadProgrammeParser.parse(doc)!.extraction.programs[0];
    // The raw heading is "MBA in Global Management MBA in Global Management".
    expect(p.name).toBe("MBA in Global Management");
  });

  it("reads the definition-list fields", () => {
    const p = daadProgrammeParser.parse(doc)!.extraction.programs[0];
    expect(p.degreeLevel).toBe("MASTER");
    expect(p.durationMonths).toBe(18); // "3 semesters"
    expect(p.tuitionType).toBe("PAID");
    expect(p.tuitionAmount).toBe(5633);
    expect(p.tuitionCurrency).toBe("EUR");
    expect(p.tuitionPeriod).toBe("PER_SEMESTER");
    expect(p.instructionLanguages).toContain("English");
  });

  it("takes the university and its website from the page, never guessing", () => {
    const { extraction } = daadProgrammeParser.parse(doc)!;
    const u = extraction.universities[0];
    expect(u.name).toBe("Bremen University of Applied Sciences");
    expect(u.city).toBe("Bremen");
    expect(u.country).toBe("DE");
    // Sourced from the anchor text matching the university name — a
    // fabricated URL here would corrupt university dedupe.
    expect(u.website).toMatch(/^https?:\/\//);
    expect(extraction.programs[0].universityWebsite).toBe(u.website);
  });

  it("keeps a prose application period as dateText and invents no date", () => {
    const p = daadProgrammeParser.parse(doc)!.extraction.programs[0];
    expect(p.deadlines.length).toBeGreaterThan(0);
    expect(p.deadlines[0].date).toBeNull();
    expect(p.deadlines[0].dateText).toMatch(/application deadline/i);
  });

  it("reports admission requirements as needing interpretation", () => {
    const { extraction, coverage } = daadProgrammeParser.parse(doc)!;
    expect(extraction.programs[0].requirements).toEqual([]);
    expect(coverage.unfilled).toContain("programs[0].requirements");
  });

  it("returns null for a page that is not this template", () => {
    expect(
      daadProgrammeParser.parse({ ...doc, markdown: "nothing here" }),
    ).toBeNull();
  });
});
