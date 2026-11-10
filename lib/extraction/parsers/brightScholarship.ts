import type { ExtractionFile } from "../schemas";
import type { SourceDocumentInput } from "../types";
import type { ParserResult, SourceParser } from "./types";
import { resolveCountryList } from "@/lib/constants/countryNames";

/**
 * Deterministic parser for brightscholarship.com posts.
 *
 * Unlike DAAD, this is a WordPress aggregator with no fielded template — but
 * almost every post opens with a summary table that is highly regular.
 * Measured across the 1,837 crawled posts:
 *
 *   Eligible nationality  1,370      Degree level     696
 *   Award country         1,224      University       615
 *   Scholarship coverage  1,091      Duration         402
 *   Last date             1,028      Offered by       392
 *
 * That table carries most of what the schema needs, at zero API cost. The
 * prose sections around it ("Eligibility Criteria", "Financial Benefits") are
 * left to the LLM stage via `focusText`.
 *
 * This source matters for a second reason: 615 posts name a specific
 * university. DAAD never does — it states rules, not institutions — so this is
 * the first source capable of producing source-stated (rather than inferred)
 * scholarship-to-institution links.
 *
 * Authority is DISCOVERY. Nothing here is treated as confirmed fact.
 */

/**
 * Table labels vary in case and wording between posts. Aliases are listed in
 * descending observed frequency; the first present wins.
 */
const FIELD = {
  provider: ["offered by", "organization", "organisation", "provided by", "funded by", "institute", "host organization"],
  coverage: ["scholarship coverage", "internship coverage", "fellowship coverage", "coverage", "program coverage"],
  deadline: ["last date", "deadline", "application deadline", "last date to apply"],
  country: ["award country", "job country", "host country", "study country", "country"],
  degree: ["degree level", "education", "study level", "level of study"],
  university: ["university", "host university", "institute"],
  nationality: ["eligible nationality", "eligible nationalities", "nationality"],
  duration: ["duration", "program duration", "scholarship duration"],
} as const;

/**
 * WordPress wraps the post in navigation, related-article lists and a footer
 * that together outweigh the article itself — a 29 KB page carries roughly
 * 4 KB of content. Both ends are trimmed before anything is read.
 */
function articleBody(markdown: string): string {
  const start = markdown.search(/^#\s+\S/m);
  const body = start >= 0 ? markdown.slice(start) : markdown;
  // Everything from the related-articles block onward is other posts' titles,
  // which would otherwise be mistaken for this post's own content.
  const end = body.search(/^#{2,4}\s+(Related Articles|Scholarships by Countries|Latest Articles|Stay Connected)/m);
  return end > 0 ? body.slice(0, end) : body;
}

/** Strips markdown emphasis, links and trailing punctuation from a cell. */
function cleanCell(text: string): string {
  return text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    // Trim first: these cells are padded ("| **Offered by:**  |"), so
    // stripping the colon before trimming never matches and every label
    // silently keeps its colon.
    .replace(/:$/, "")
    .trim();
}

/** Parses the two-column summary table into a lowercased label -> value map. */
function parseSummaryTable(body: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const line of body.split(/\r?\n/)) {
    if (!line.trimStart().startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1);
    if (cells.length !== 2) continue;
    const label = cleanCell(cells[0]).toLowerCase();
    const value = cleanCell(cells[1]);
    // The markdown separator row ("| --- | --- |") has no content.
    if (!label || !value || /^-+$/.test(label)) continue;
    if (!out.has(label)) out.set(label, value);
  }
  return out;
}

/**
 * "Fully Funded" -> FULL_FUNDING. Only unambiguous wording is claimed.
 *
 * "Funded" on its own (252 posts) deliberately stays UNKNOWN: it says money is
 * involved, not what the money covers, and UNKNOWN is a real answer in this
 * schema rather than a gap.
 */
function coverageFrom(text: string | null): string {
  if (!text) return "UNKNOWN";
  const t = text.toLowerCase();
  if (/fully\s*(&|and)\s*partially/.test(t)) return "VARIES";
  if (/fully funded|full funding|full scholarship/.test(t)) return "FULL_FUNDING";
  if (/partial/.test(t)) return "PARTIAL_TUITION";
  if (/tuition fee\s*\+\s*stipend/.test(t)) return "FULL_FUNDING";
  if (/tuition/.test(t)) return "FULL_TUITION";
  if (/stipend|salary|monthly/.test(t)) return "STIPEND";
  if (/travel|airfare/.test(t)) return "TRAVEL";
  return "UNKNOWN";
}

const DEGREE_TOKENS: Array<[RegExp, string]> = [
  [/\b(phd|ph\.d|doctoral|doctorate)\b/i, "PHD"],
  [/\b(master|masters|master's|msc|ms|mba|postgraduate|graduate)\b/i, "MASTER"],
  [/\b(bachelor|bachelors|bachelor's|undergraduate|bsc|bs)\b/i, "BACHELOR"],
  [/\b(diploma)\b/i, "DIPLOMA"],
  [/\b(certificate|short course)\b/i, "CERTIFICATE"],
  [/\b(high school|secondary)\b/i, "HIGH_SCHOOL"],
];

/** "Bachelors, Masters, PhD" -> ["BACHELOR","MASTER","PHD"]. */
function degreeLevelsFrom(text: string | null): string[] {
  if (!text) return [];
  const found: string[] = [];
  for (const [pattern, level] of DEGREE_TOKENS) {
    if (pattern.test(text) && !found.includes(level)) found.push(level);
  }
  return found;
}

/**
 * A named institution, or a category of them.
 *
 * "Canadian Universities" and "UK Universities" are the two most common values
 * in this column. They are not institutions, and resolving them against the
 * catalogue would attach a scholarship to whichever university happened to
 * match the word "Canadian". Only a value that names one is kept.
 */
function namedUniversity(text: string | null): string | null {
  if (!text) return null;
  const t = text.trim();
  if (!t || t.length < 4 || t.length > 120) return null;
  if (/^(various|multiple|several|any|all)\b/i.test(t)) return null;
  // Plural "… Universities" is a category; singular "University of X" is not.
  if (/\buniversities\b/i.test(t)) return null;
  if (/^(worldwide|global|different)\b/i.test(t)) return null;
  return t;
}

/**
 * Posts this aggregator publishes that are not funding at all.
 *
 * Two kinds, both measured against the 1,871 crawled titles:
 *
 *   Exam results and board notices (129 posts) — "BISE Lahore 12th Class
 *   Result Gazette", "Goa Board 12th Class Result".
 *   Employment listings (101 posts) — "1,000 Coca Cola jobs in Canada",
 *   "Qatar Airways Jobs", "Islamabad Police Jobs". These are the more
 *   dangerous of the two: stored as scholarships they would be expanded
 *   across the university catalogue by the linker.
 *
 * Checked against every title before adopting: none of the 101 employment
 * matches mentions a scholarship, fellowship, grant, studentship or bursary,
 * so the filter costs nothing real. Funded programmes that happen to be paid
 * work — "NATO Young Professionals Program", research internships — do not
 * match and are kept.
 */
const NOT_AN_OPPORTUNITY =
  /\b(class result|result \d{4}|date sheet|roll number|past papers|merit list|admission form)\b|\bjobs\b|visa sponsorship|careers online|recruitment|vacanc|\bhiring\b/i;

export class BrightScholarshipParser implements SourceParser {
  readonly sourceId = "src-bright-scholarship";

  matches(doc: SourceDocumentInput): boolean {
    if (!doc.url.includes("brightscholarship.com/")) return false;
    // Category, tag, author and pagination URLs are listings of other posts,
    // not posts themselves.
    if (/\/(category|tag|author|page)\//.test(doc.url)) return false;
    // The site root is the homepage feed.
    try {
      return new URL(doc.url).pathname.replace(/\/+$/, "") !== "";
    } catch {
      return false;
    }
  }

  parse(doc: SourceDocumentInput): ParserResult | null {
    const body = articleBody(doc.markdown);

    const titleMatch = body.match(/^#\s+(.+)$/m);
    if (!titleMatch) return null;
    const name = cleanCell(titleMatch[1]);
    if (!name) return null;

    const filled: string[] = [];
    const unfilled: string[] = [];
    const warnings: string[] = [];

    if (NOT_AN_OPPORTUNITY.test(name)) {
      warnings.push(`"${name}" is not a funding opportunity — skipped`);
      return {
        extraction: {
          sourceId: this.sourceId,
          sourceDocumentId: doc.sourceDocumentId,
          extractedBy: "manual",
          extractedAt: new Date().toISOString(),
          universities: [],
          programs: [],
          scholarships: [],
        },
        coverage: { filled, unfilled, warnings },
      };
    }

    const table = parseSummaryTable(body);
    const get = (aliases: readonly string[]): string | null => {
      for (const alias of aliases) {
        const v = table.get(alias);
        if (v) return v;
      }
      return null;
    };

    const universityName = namedUniversity(get(FIELD.university));
    const providerRaw = get(FIELD.provider);
    // The provider is stated outright, or is the named host institution. When
    // neither is on the page the LLM stage supplies it from the prose, where
    // it is almost always named in the opening paragraph — inventing one here
    // would put an unsourced organisation on a citable record.
    const providerName = providerRaw ?? universityName;
    if (!providerName) {
      unfilled.push("scholarships[0].providerName");
    } else {
      filled.push("scholarships[0].providerName");
    }

    const countryRaw = get(FIELD.country);
    const countries = countryRaw ? resolveCountryList(countryRaw) : [];
    // A single resolved country is the record's country. Several means the
    // award spans countries, which one column cannot express, so it stays null
    // and the full list is carried as an applicability rule instead.
    const country = countries.length === 1 ? countries[0] : null;
    if (country) filled.push("scholarships[0].country");
    else if (countryRaw) unfilled.push("scholarships[0].country");

    const coverageRaw = get(FIELD.coverage);
    const coverageType = coverageFrom(coverageRaw);
    if (coverageType !== "UNKNOWN") filled.push("scholarships[0].coverageType");
    else unfilled.push("scholarships[0].coverageType");

    const deadlineText = get(FIELD.deadline);
    if (deadlineText) filled.push("scholarships[0].deadlineText");

    const degreeLevels = degreeLevelsFrom(get(FIELD.degree));
    const nationalityRaw = get(FIELD.nationality);

    // The official application URL, when the post links one out.
    const officialMatch = body.match(/\[\s*(?:Official Link|Official Website|Apply Now|Application Link)\s*\]\((https?:\/\/[^)\s]+)/i);
    const officialSourceUrl = officialMatch?.[1] ?? null;
    if (officialSourceUrl) filled.push("scholarships[0].officialSourceUrl");

    // Eligibility and applicability come from prose; the table only seeds them.
    unfilled.push("scholarships[0].eligibility[]");
    if (!degreeLevels.length) unfilled.push("scholarships[0].applicability");

    // The lead paragraph, for description and as the record's quote.
    const leadMatch = body.match(/^##\s+.*$\n+([^\n|#][^\n]{60,})/m);
    const lead = leadMatch ? cleanCell(leadMatch[1]) : null;
    const description = lead ? lead.slice(0, 1500) : null;
    if (description) filled.push("scholarships[0].description");

    const sourceQuote = lead ?? name;

    const extraction: ExtractionFile = {
      sourceId: this.sourceId,
      sourceDocumentId: doc.sourceDocumentId,
      extractedBy: "manual",
      extractedAt: new Date().toISOString(),
      universities: [],
      programs: [],
      scholarships: [
        {
          name,
          // Placeholder only when the page states neither; the LLM replaces it
          // and the loader is told via coverage.unfilled that it is missing.
          providerName: providerName ?? name,
          // A named university is the awarding body; otherwise this record came
          // to us through an aggregator and is typed as such.
          providerType: universityName ? "UNIVERSITY" : "SCHOLARSHIP_PROVIDER",
          country,
          amount: null,
          amountCurrency: null,
          coverageType: coverageType as never,
          description,
          applicationUrl: doc.url,
          deadlineText,
          isRenewable: null,
          // DISCOVERY provenance: found via an aggregator, not read off an
          // official page. officialSourceUrl is where it could be confirmed.
          discoveredFrom: this.sourceId,
          discoveryUrl: doc.url,
          officialSourceUrl,
          sourceUrl: doc.url,
          sourceQuote,
          eligibility: nationalityRaw
            ? [
                {
                  criterionType: "NATIONALITY" as never,
                  operator: "IN_LIST" as never,
                  valueList: [nationalityRaw],
                  numericValue: null,
                  textValue: null,
                  sourceQuote: nationalityRaw,
                  sourceUrl: null,
                },
              ]
            : [],
          applicability:
            countries.length > 0 || degreeLevels.length > 0
              ? [
                  {
                    countries,
                    degreeLevels: degreeLevels as never[],
                    fieldCategories: [],
                    institutionTypes: [],
                    sourceQuote: [countryRaw, get(FIELD.degree)].filter(Boolean).join(" — ") || name,
                    sourceUrl: null,
                  },
                ]
              : [],
          deadlines: [],
        },
      ],
    };

    // Sections worth sending to the model — the summary table is already
    // parsed, so only the prose goes.
    const focusParts: string[] = [`# ${name}`];
    const sectionPattern = /^#{2,4}\s+\*{0,2}([^*\n]+?)\*{0,2}:?\s*$/gm;
    const headings = [...body.matchAll(sectionPattern)];
    for (let i = 0; i < headings.length; i += 1) {
      const heading = headings[i][1].trim();
      if (!/eligib|benefit|requirement|criteria|who can|coverage|about|overview|description|field/i.test(heading)) {
        continue;
      }
      const start = headings[i].index! + headings[i][0].length;
      const end = i + 1 < headings.length ? headings[i + 1].index! : body.length;
      const section = body.slice(start, end).trim();
      if (section) focusParts.push(`### ${heading}\n${section.slice(0, 2500)}`);
    }

    if (universityName) {
      filled.push("scholarships[0].hostUniversity");
    }

    return {
      extraction,
      coverage: { filled, unfilled, warnings },
      focusText: focusParts.join("\n\n"),
    };
  }
}

export const brightScholarshipParser = new BrightScholarshipParser();
