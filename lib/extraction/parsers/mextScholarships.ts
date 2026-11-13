import type { ExtractionFile } from "../schemas";
import type { SourceDocumentInput } from "../types";
import type { ParserResult, SourceParser } from "./types";

/**
 * MEXT's own page on the Japanese Government (MEXT) Scholarship, read into
 * one record per scholarship type.
 *
 * The page states seven types (research students, undergraduate students,
 * Young Leaders Program and others), each with its own level, length,
 * monthly amount and age limit, in two tables. The generic parser read the
 * whole page as one award named after its heading, "Scholarships", which
 * then merged with an unrelated record of the same name.
 *
 * The tables use merged cells ("¥117,000 per month" spans four types), and
 * merged cells survive only in the HTML, so this parser reads the HTML.
 * Nothing is inferred: a range ("¥143,000～145,000") gives no single amount,
 * and a type's levels are only those the page states.
 */

const PAGE = /^https?:\/\/www\.studyinjapan\.go\.jp\/en\/planning\/scholarships\/mext-scholarships\/?$/;
const PROVIDER = "Ministry of Education, Culture, Sports, Science and Technology (MEXT), Japan";

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", yen: "¥" };

function text(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e: string) => {
      if (e.startsWith("#x") || e.startsWith("#X")) return String.fromCodePoint(parseInt(e.slice(2), 16));
      if (e.startsWith("#")) return String.fromCodePoint(Number(e.slice(1)));
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/\s+/g, " ")
    .trim();
}

/** Rows of cell texts, with merged cells (colspan) repeated across the columns they span. */
export function tableRows(tableHtml: string): string[][] {
  const rows: string[][] = [];
  for (const row of tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells: string[] = [];
    for (const cell of row[1].matchAll(/<t([dh])\b([^>]*)>([\s\S]*?)<\/t\1>/gi)) {
      const span = Number(cell[2].match(/colspan\s*=\s*["']?(\d+)/i)?.[1] ?? 1);
      const value = text(cell[3]);
      for (let i = 0; i < Math.max(1, span); i++) cells.push(value);
    }
    rows.push(cells);
  }
  return rows;
}

/** The first table after the heading element whose text starts with `heading`. */
function tableAfter(html: string, heading: string): string | null {
  const at = html.search(new RegExp(`<h[1-6][^>]*>\\s*${heading}`, "i"));
  if (at < 0) return null;
  return html.slice(at).match(/<table\b[\s\S]*?<\/table>/i)?.[0] ?? null;
}

/** A cell as a sentence: its own full stop, or one added. */
const sentence = (label: string, value: string | undefined) => (value ? `${label}${value}${/[.!?]$/.test(value) ? "" : "."}` : null);

/** "Young leaders program (YLP) students (*2)" -> "Young Leaders Program (YLP) Students". */
function typeTitle(header: string): string {
  return header
    .replace(/\(\*\d+\)/g, "")
    .trim()
    .replace(/\b([a-z])([a-z]*)/g, (w, first: string, rest: string) => (/^(of|and|for|the)$/.test(w) ? w : first.toUpperCase() + rest));
}

/** "¥117,000 per month" -> 117000; a range or anything unclear -> null. */
function monthlyYen(cell: string): number | null {
  if (/[～~〜]|–|-\s*\d/.test(cell)) return null;
  const m = cell.match(/^[¥￥]\s?([\d,]+)\s+per month$/i);
  return m ? Number(m[1].replace(/,/g, "")) : null;
}

type Eligibility = ExtractionFile["scholarships"][number]["eligibility"][number];

function ageLimit(sentence: string, url: string): Eligibility | null {
  const under = sentence.match(/under (\d+) years of age/i);
  if (under) {
    return { criterionType: "MAX_AGE", operator: "LT", valueList: [], numericValue: Number(under[1]), textValue: null, sourceQuote: under[0], sourceUrl: url };
  }
  const between = sentence.match(/between (\d+) and (\d+) years old/i);
  if (between) {
    return { criterionType: "MAX_AGE", operator: "LTE", valueList: [], numericValue: Number(between[2]), textValue: null, sourceQuote: between[0], sourceUrl: url };
  }
  return null;
}

type DegreeLevel = ExtractionFile["scholarships"][number]["applicability"][number]["degreeLevels"][number];

/** Degree levels the page states for a type, through its field of study. */
function levelsFor(type: string, field: string): DegreeLevel[] {
  if (/research students/i.test(type) && /graduate school/i.test(field)) return ["MASTER", "PHD"];
  if (/master course/i.test(field)) return ["MASTER"];
  if (/undergraduate education/i.test(field)) return ["BACHELOR"];
  return [];
}

export const mextScholarshipsParser: SourceParser = {
  sourceId: "src-mext",
  matches(doc: SourceDocumentInput) {
    return PAGE.test(doc.url) && Boolean(doc.html?.includes("Types and Their Status"));
  },
  parse(doc: SourceDocumentInput): ParserResult | null {
    const html = doc.html ?? "";
    const typesTable = tableAfter(html, "Types and Their Status");
    const eligibilityTable = tableAfter(html, "Eligibility");
    if (!typesTable || !eligibilityTable) return null;

    const rows = tableRows(typesTable);
    const header = rows[0];
    if (!header || header.length < 3) return null;
    const types = header.slice(1);
    const row = (label: RegExp) => rows.find((r) => label.test(r[0] ?? ""))?.slice(1) ?? [];
    const embassy = row(/^Embassy recommendation/i);
    const university = row(/^University recommendation/i);
    const level = row(/^Level of studies/i);
    const duration = row(/^Duration/i);
    const field = row(/^Field of study/i);
    const stipend = row(/^Scholarship/i);
    const tuition = row(/^Tuition/i);
    const travel = row(/^Travel allowance/i);

    const eligibilityByType = new Map(
      tableRows(eligibilityTable)
        .filter((r) => r.length >= 2)
        .map((r) => [r[0].toLowerCase().replace(/\s+/g, " ").trim(), r[1]] as const),
    );

    const scholarships: ExtractionFile["scholarships"] = types.map((rawType, i) => {
      const title = typeTitle(rawType);
      const stated = eligibilityByType.get(title.toLowerCase()) ?? eligibilityByType.get(rawType.replace(/\(\*\d+\)/g, "").trim().toLowerCase()) ?? null;
      const amount = monthlyYen(stipend[i] ?? "");
      const fullyFunded = /exempt/i.test(tuition[i] ?? "") && /per month/i.test(stipend[i] ?? "") && /airfare|travel/i.test(travel[i] ?? "");
      const routes = [embassy[i] === "Yes" ? "embassy recommendation" : null, /^Yes/.test(university[i] ?? "") ? "university recommendation" : null].filter(Boolean);
      const eligibility: Eligibility[] = [];
      if (stated) {
        const age = ageLimit(stated, doc.url);
        if (age) eligibility.push(age);
        eligibility.push({ criterionType: "OTHER", operator: "BOOLEAN_TRUE", valueList: [], numericValue: null, textValue: stated, sourceQuote: stated, sourceUrl: doc.url });
      }
      const degreeLevels = levelsFor(rawType, field[i] ?? "");
      const description = [
        sentence("", level[i]),
        sentence("Field of study: ", field[i]),
        sentence("Duration: ", duration[i]),
        sentence("Scholarship: ", stipend[i]),
        sentence("Tuition: ", tuition[i]),
        sentence("Travel: ", travel[i]),
        routes.length ? `Apply through ${routes.join(" or ")}.` : null,
      ]
        .filter(Boolean)
        .join(" ");

      return {
        name: `Japanese Government (MEXT) Scholarship: ${title}`,
        providerName: PROVIDER,
        providerType: "GOVERNMENT",
        country: "JP",
        amount,
        amountCurrency: amount === null ? null : "JPY",
        amountPeriod: amount === null ? null : "MONTH",
        coverageType: fullyFunded ? "FULL_FUNDING" : "UNKNOWN",
        description,
        applicationUrl: doc.url,
        deadlineText: null,
        isRenewable: null,
        discoveredFrom: null,
        discoveryUrl: null,
        officialSourceUrl: null,
        sourceUrl: doc.url,
        sourceQuote: stated ?? `${rawType}: ${field[i] ?? ""}`.trim(),
        eligibility,
        applicability: [
          {
            countries: ["JP"],
            degreeLevels,
            fieldCategories: [],
            institutionTypes: [],
            sourceQuote: field[i] || rawType,
            sourceUrl: doc.url,
          },
        ],
        deadlines: [],
      };
    });

    const extraction: ExtractionFile = {
      sourceId: "src-mext",
      sourceDocumentId: doc.sourceDocumentId,
      extractedBy: "manual",
      extractedAt: new Date().toISOString(),
      universities: [],
      programs: [],
      scholarships,
    };
    return {
      extraction,
      coverage: {
        filled: scholarships.map((_, i) => `scholarships[${i}]`),
        unfilled: [],
        warnings: types.length === 7 ? [] : [`expected 7 MEXT scholarship types, found ${types.length}`],
      },
    };
  },
};
