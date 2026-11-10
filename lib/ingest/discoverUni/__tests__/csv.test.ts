import { describe, it, expect } from "vitest";
import { parseCsv, parseCsvTable, pick } from "../csv";

describe("parseCsv", () => {
  it("keeps commas that sit inside quoted fields", () => {
    // Real course titles do this: "Business, Management and Marketing".
    const rows = parseCsv('A,B\n"Business, Management",BSc');
    expect(rows[1]).toEqual(["Business, Management", "BSc"]);
  });

  it("unescapes doubled quotes", () => {
    const rows = parseCsv('A\n"She said ""yes"""');
    expect(rows[1][0]).toBe('She said "yes"');
  });

  it("handles CRLF, LF and a lone CR without emitting empty rows", () => {
    expect(parseCsv("a,b\r\nc,d\ne,f\rg,h")).toEqual([
      ["a", "b"],
      ["c", "d"],
      ["e", "f"],
      ["g", "h"],
    ]);
  });

  it("strips a byte order mark from the first header", () => {
    // Left in place, the BOM becomes part of the header name and every
    // lookup against it silently returns nothing.
    const table = parseCsvTable("﻿UKPRN,TITLE\n10007777,Physics");
    expect(table.headers[0]).toBe("UKPRN");
    expect(table.rows[0].UKPRN).toBe("10007777");
  });

  it("keeps a quoted newline inside one field", () => {
    const rows = parseCsv('A,B\n"line one\nline two",x');
    expect(rows[1][0]).toBe("line one\nline two");
    expect(rows).toHaveLength(2);
  });
});

describe("pick", () => {
  const row = { TITLE: "Physics", UKPRN: "10007777" };

  it("is case-insensitive about the column name", () => {
    expect(pick(row, "title")).toBe("Physics");
  });

  it("falls through to the next alternative when a column is absent", () => {
    // The release has renamed columns between years, so a single hard-coded
    // name would turn a new release into empty records rather than an error.
    expect(pick(row, "ENGTITLE", "TITLE")).toBe("Physics");
  });

  it("returns empty string when nothing matches", () => {
    expect(pick(row, "NOPE")).toBe("");
  });
});
