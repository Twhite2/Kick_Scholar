import type { ExtractionFile } from "../schemas";
import type { SourceDocumentInput } from "../types";
import type { ParserResult, SourceParser } from "./types";
import { inferFieldCategory } from "./fieldCategory";

/**
 * Deterministic parser for DAAD "International Programmes in Germany" detail
 * pages (www2.daad.de/.../international-programmes/en/detail/<id>/).
 *
 * These pages render their facts as a markdown definition list — a label on
 * one line, the value indented beneath it:
 *
 *     Degree
 *         Master of Business Administration
 *     Programme duration
 *         3 semesters
 *     Tuition fees per semester
 *         The following tuition fees apply for applicants from: all countries
 *         **5,633 EUR**
 *
 * so the structured fields are genuinely deterministic. Free-prose fields
 * (application periods, admission requirements) are quoted verbatim and left
 * to the LLM stage via `coverage.unfilled` rather than interpreted here.
 */

const LABEL = {
  degree: "Degree",
  teachingLanguage: "Teaching language",
  languages: "Languages",
  duration: "Programme duration",
  beginning: "Beginning",
  applicationPeriods: "Application periods",
  tuitionPerSemester: "Tuition fees per semester",
} as const;

/**
 * The labels whose blocks actually carry admission requirements, in the order
 * they help the model most. Measured frequency across the 1,417 crawled
 * detail pages:
 *
 *   Description/content              1,413
 *   German language skills           1,398
 *   English language skills          1,398
 *   Academic admission requirements  1,304
 *   Language requirements exemptions   645
 *
 * Everything else on the page (accommodation, part-time work, campus life,
 * the cookie banner) is noise for this purpose. A full detail page is ~28 KB;
 * these blocks are ~1.5 KB of it.
 */
const REQUIREMENT_LABELS = [
  "Academic admission requirements",
  "German language skills",
  "English language skills",
  "Language requirements exemptions",
  "Description/content",
] as const;

/** Strips the DAAD chrome that precedes the programme content. */
function contentAfterChrome(markdown: string): string {
  const idx = markdown.search(/^##\s+International Programmes/m);
  return idx > 0 ? markdown.slice(idx) : markdown;
}

/**
 * Parses the label/indented-value definition list. A value may span several
 * indented lines (bullet lists, or a bolded amount on its own line).
 */
function isLabelLike(line: string): boolean {
  const t = line.trim();
  if (!t || t.length > 60) return false;
  if (/^[\s>#*\-|[]/.test(line)) return false;
  if (!/^[A-Z]/.test(t)) return false;
  return !/[[\]()]/.test(t);
}

function parseDefinitionList(markdown: string): Map<string, string> {
  const out = new Map<string, string>();
  const lines = markdown.split(/\r?\n/);

  for (let i = 0; i < lines.length; i += 1) {
    const label = lines[i].trim();
    if (!isLabelLike(lines[i])) continue;

    const value: string[] = [];
    // DAAD uses two layouts. Most fields indent the value under the label:
    //     Degree
    //         Master of Business Administration
    // but some (notably "Application periods") emit a whitespace-only line
    // and then an UNINDENTED value:
    //     Application periods
    //     <spaces>
    //     For application deadline please check the [website](...).
    // Handling only the indented form silently dropped every deadline.
    let sawBlankAfterLabel = false;
    for (let j = i + 1; j < lines.length; j += 1) {
      const raw = lines[j];
      if (raw.trim() === "") {
        if (value.length === 0) {
          sawBlankAfterLabel = true;
          continue;
        }
        const next = lines[j + 1] ?? "";
        if (/^\s{2,}\S/.test(next) || /^\*\*/.test(next.trim())) continue;
        break;
      }
      if (/^\s{2,}\S/.test(raw) || /^\*\*.+\*\*\s*$/.test(raw.trim())) {
        value.push(raw.trim());
        sawBlankAfterLabel = false;
        continue;
      }
      // Unindented line directly after the blank: accept it as the value only
      // when it cannot itself be a label (labels are short, capitalised and
      // carry no markdown), so we never swallow the next field's name.
      if (sawBlankAfterLabel && value.length === 0 && !isLabelLike(raw)) {
        value.push(raw.trim());
        break;
      }
      break;
    }

    if (value.length > 0) {
      const joined = value
        .map((v) => v.replace(/^[*-]\s*/, "").trim())
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (joined && !out.has(label)) out.set(label, joined);
    }
  }
  return out;
}

/**
 * The RAW, unflattened lines beneath a definition-list label.
 *
 * `parseDefinitionList` collapses bullets and whitespace, which is right for
 * storing a value but wrong for `focusText`: focusText is sent to the model,
 * and the model's quotes are then verified against the original page. Slicing
 * the source lines keeps those two texts identical by construction instead of
 * relying on the quote normaliser to paper over the difference.
 */
function rawBlock(markdown: string, label: string): string | null {
  const lines = markdown.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    if (!isLabelLike(lines[i]) || lines[i].trim() !== label) continue;
    const out: string[] = [];
    for (let j = i + 1; j < lines.length; j += 1) {
      if (isLabelLike(lines[j])) break;
      out.push(lines[j]);
    }
    const text = out.join("\n").trim();
    if (text) return text;
  }
  return null;
}

/** "Master of Business Administration" -> MASTER. Null when not stated. */
function degreeLevelFrom(degreeText: string | null): string | null {
  if (!degreeText) return null;
  const t = degreeText.toLowerCase();
  if (/(phd|ph\.d|doctor|doctoral|^dr|dr\.?$)/.test(t)) return "PHD";
  if (/(master|m\.sc|msc|mba|m\.eng|m\.a\b|magister)/.test(t)) return "MASTER";
  if (/(bachelor|b\.sc|bsc|b\.eng|b\.a\b)/.test(t)) return "BACHELOR";
  if (/certificate/.test(t)) return "CERTIFICATE";
  if (/diploma/.test(t)) return "DIPLOMA";
  return null;
}

/** "3 semesters" -> 18 months. Only units that convert unambiguously. */
function durationMonthsFrom(text: string | null): number | null {
  if (!text) return null;
  const semesters = text.match(/(\d+(?:\.\d+)?)\s*semester/i);
  if (semesters) return Math.round(parseFloat(semesters[1]) * 6);
  const months = text.match(/(\d+)\s*month/i);
  if (months) return parseInt(months[1], 10);
  const years = text.match(/(\d+(?:\.\d+)?)\s*year/i);
  if (years) return Math.round(parseFloat(years[1]) * 12);
  return null;
}

/** Extracts "**5,633 EUR**" -> { amount: 5633, currency: "EUR" }. */
function moneyFrom(text: string | null): { amount: number; currency: string } | null {
  if (!text) return null;
  const m = text.match(/(\d[\d.,\s]*)\s*(EUR|USD|GBP|CHF)\b/i);
  if (!m) return null;
  const amount = Number(m[1].replace(/[\s,]/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return { amount, currency: m[2].toUpperCase() };
}

function emptyExtraction(doc: SourceDocumentInput): ExtractionFile {
  return {
    sourceId: "src-daad-programmes",
    sourceDocumentId: doc.sourceDocumentId,
    extractedBy: "manual",
    extractedAt: new Date().toISOString(),
    universities: [],
    programs: [],
    scholarships: [],
  };
}

export class DaadProgrammeParser implements SourceParser {
  readonly sourceId = "src-daad-programmes";

  matches(doc: SourceDocumentInput): boolean {
    return /international-programmes\/en\/detail\/\d+/.test(doc.url);
  }

  parse(doc: SourceDocumentInput): ParserResult | null {
    const body = contentAfterChrome(doc.markdown);
    const filled: string[] = [];
    const unfilled: string[] = [];
    const warnings: string[] = [];

    // DAAD renders the programme title twice inside one heading, e.g.
    // "MBA in Global Management MBA in Global Management".
    //
    // Collect every H2 and filter in code rather than using a negative
    // lookahead: `^##\s+(?!International Programmes)` backtracks — `\s+`
    // gives back one of the two spaces DAAD emits, the lookahead then sees a
    // leading space, does not match, and the page-chrome heading is captured
    // as the programme name. Every programme came out as "International
    // Programmes 2026/2027" until this was filtered explicitly.
    const CHROME_HEADINGS = /^(international programmes|pagination|services|cookie consent|gallery)\b/i;
    const headings = [...body.matchAll(/^##[ \t]+(.+?)[ \t]*$/gm)]
      .map((m) => m[1].trim())
      .filter((h) => h.length > 0 && !CHROME_HEADINGS.test(h));
    if (headings.length === 0) return null;
    let name = headings[0];
    const half = name.slice(0, Math.floor(name.length / 2)).trim();
    if (half.length > 3 && name.toLowerCase() === `${half} ${half}`.toLowerCase()) {
      name = half;
    }
    if (!name) return null;

    // "### Bremen University of Applied Sciences • Bremen"
    const uniMatch = body.match(/^###\s+(.+?)\s*[•·]\s*(.+?)\s*$/m);
    if (!uniMatch) {
      warnings.push("no '### University • City' heading found");
      return { extraction: emptyExtraction(doc), coverage: { filled, unfilled, warnings } };
    }
    const universityName = uniMatch[1].trim();
    const city = uniMatch[2].trim();

    // The university's own site appears as a markdown link whose anchor text
    // is the university name. Taken from the page, never guessed — the schema
    // requires a URL here and a fabricated one would corrupt dedupe.
    const escaped = universityName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const linkMatch = doc.markdown.match(
      new RegExp(`\\[\\s*${escaped}\\s*\\]\\((https?://[^)\\s]+)`, "i"),
    );
    const universityWebsite = linkMatch?.[1] ?? null;
    if (!universityWebsite) {
      warnings.push(
        `no website link found for "${universityName}" — skipped rather than fabricating the required universityWebsite`,
      );
      return { extraction: emptyExtraction(doc), coverage: { filled, unfilled, warnings } };
    }

    const fields = parseDefinitionList(body);
    const get = (label: string): string | null => fields.get(label) ?? null;

    const degreeText = get(LABEL.degree);
    const degreeLevel = degreeLevelFrom(degreeText);
    if (!degreeLevel) {
      warnings.push(
        `could not determine degree level from "${degreeText ?? "(no Degree field)"}" — skipped rather than guessing`,
      );
      return { extraction: emptyExtraction(doc), coverage: { filled, unfilled, warnings } };
    }
    filled.push("programs[0].degreeLevel");

    const durationMonths = durationMonthsFrom(get(LABEL.duration));
    if (durationMonths !== null) filled.push("programs[0].durationMonths");
    else if (get(LABEL.duration)) unfilled.push("programs[0].durationMonths");

    const languageText = get(LABEL.teachingLanguage) ?? get(LABEL.languages);
    const instructionLanguages = languageText
      ? [
          ...new Set(
            languageText
              .split(/[,/]|\band\b|\bonly\b/i)
              .map((s) => s.trim())
              .filter((s) => /^[A-Za-z ]{3,20}$/.test(s)),
          ),
        ]
      : [];
    if (instructionLanguages.length > 0) filled.push("programs[0].instructionLanguages");

    const tuitionRaw = get(LABEL.tuitionPerSemester);
    const money = moneyFrom(tuitionRaw);
    const noFees = tuitionRaw !== null && /no tuition fee|none/i.test(tuitionRaw);
    let tuitionType = "UNKNOWN";
    let tuitionAmount: number | null = null;
    let tuitionCurrency: string | null = null;
    let tuitionPeriod: string | null = null;
    if (money) {
      tuitionType = "PAID";
      tuitionAmount = money.amount;
      tuitionCurrency = money.currency;
      tuitionPeriod = "PER_SEMESTER";
      filled.push("programs[0].tuitionAmount");
    } else if (noFees) {
      tuitionType = "FREE";
      filled.push("programs[0].tuitionType");
    } else if (tuitionRaw) {
      unfilled.push("programs[0].tuitionAmount");
    }

    const beginning = get(LABEL.beginning);
    const intakes = beginning
      ? beginning.split(/,|\band\b/i).map((s) => s.trim()).filter(Boolean)
      : [];
    if (intakes.length > 0) filled.push("programs[0].intakes");

    // Reuses the same heuristic the matching engine uses, so a programme is
    // never stored under one category and matched under another.
    const inferred = inferFieldCategory(name);
    const fieldCategory = inferred ?? "OTHER";
    if (inferred) filled.push("programs[0].fieldCategory");
    else unfilled.push("programs[0].fieldCategory");

    const applicationPeriods = get(LABEL.applicationPeriods);
    unfilled.push("programs[0].requirements");

    const extraction: ExtractionFile = {
      sourceId: this.sourceId,
      sourceDocumentId: doc.sourceDocumentId,
      extractedBy: "manual",
      extractedAt: new Date().toISOString(),
      universities: [
        {
          name: universityName,
          country: "DE",
          city,
          website: universityWebsite,
          description: null,
          sourceUrl: doc.url,
          sourceQuote: `${universityName} • ${city}`,
        },
      ],
      programs: [
        {
          universityName,
          universityWebsite,
          name,
          degreeLevel: degreeLevel as never,
          fieldOfStudy: name,
          fieldCategory: fieldCategory as never,
          durationMonths,
          instructionLanguages,
          tuitionType: tuitionType as never,
          tuitionAmount,
          tuitionCurrency,
          tuitionPeriod: tuitionPeriod as never,
          intakes,
          programUrl: doc.url,
          description: null,
          sourceUrl: doc.url,
          sourceQuote: degreeText ? `Degree ${degreeText}` : name,
          requirements: [],
          deadlines: applicationPeriods
            ? [
                {
                  deadlineType: "APPLICATION" as never,
                  date: null,
                  // Application periods are prose ("For application deadline
                  // please check the website"), never a parseable date — so
                  // this stays dateText rather than inventing one.
                  dateText: applicationPeriods,
                  intake: null,
                  sourceQuote: applicationPeriods,
                  sourceUrl: null,
                },
              ]
            : [],
        },
      ],
      scholarships: [],
    };

    filled.push("universities[0]", "programs[0].name", "programs[0].programUrl");

    // The requirement-bearing blocks only — see ParserResult.focusText.
    const focusParts: string[] = [`## ${name}`];
    if (degreeText) focusParts.push(`Degree\n    ${degreeText}`);
    for (const label of REQUIREMENT_LABELS) {
      const block = rawBlock(body, label);
      if (block) focusParts.push(`${label}\n${block}`);
    }

    return {
      extraction,
      coverage: { filled, unfilled, warnings },
      focusText: focusParts.join("\n\n"),
    };
  }
}

export const daadProgrammeParser = new DaadProgrammeParser();
