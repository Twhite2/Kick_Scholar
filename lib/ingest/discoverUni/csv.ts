/**
 * A minimal RFC 4180 CSV reader.
 *
 * Written rather than installed because the project needs exactly this much:
 * the Discover Uni release is well-formed government CSV, and a dependency
 * for forty lines of parsing is a poor trade. It does handle the two things
 * naive splitting gets wrong - quoted fields containing commas, and escaped
 * quotes inside them - because course titles contain both.
 */

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  // Strip a UTF-8 BOM, which would otherwise become part of the first header
  // and silently break every lookup against it.
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 1; // a doubled quote is one literal quote
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      // Accept CRLF, LF and lone CR without emitting a phantom empty row.
      if (char === "\r" && input[i + 1] === "\n") i += 1;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export interface CsvTable {
  headers: string[];
  rows: Array<Record<string, string>>;
}

/**
 * Parses into records keyed by header.
 *
 * Headers are upper-cased because the Discover Uni release has changed their
 * casing between years and a case-sensitive lookup would fail silently on a
 * new release rather than loudly.
 */
export function parseCsvTable(text: string): CsvTable {
  const raw = parseCsv(text).filter((r) => r.some((c) => c.trim() !== ""));
  if (raw.length === 0) return { headers: [], rows: [] };
  const headers = raw[0].map((h) => h.trim().toUpperCase());
  const rows = raw.slice(1).map((cells) => {
    const record: Record<string, string> = {};
    headers.forEach((h, i) => {
      record[h] = (cells[i] ?? "").trim();
    });
    return record;
  });
  return { headers, rows };
}

/**
 * Reads the first header that exists, trying each alternative in turn.
 *
 * The dataset renames columns between releases (TITLE became ENGTITLE at one
 * point), so a single hard-coded name turns a new release into empty records
 * instead of an error.
 */
export function pick(row: Record<string, string>, ...names: string[]): string {
  for (const name of names) {
    const value = row[name.toUpperCase()];
    if (value) return value;
  }
  return "";
}
