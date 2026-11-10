import type { ExtractionFile } from "../schemas";
import type { SourceDocumentInput } from "../types";
import type { ParserResult, SourceParser } from "./types";

/**
 * A parser for curated, single-provider scholarship sites whose pages are
 * prose rather than fielded templates.
 *
 * DAAD and Bright Scholarship each publish a rigid structure - a definition
 * list, a summary table - so a bespoke parser could read most fields for free.
 * The government sources (Chevening, Commonwealth, MEXT, Erasmus Mundus,
 * Turkiye Burslari) publish ordinary prose under ordinary headings. There is
 * no table to read, so a bespoke parser per source would be five times the
 * code for no deterministic gain.
 *
 * What this does instead is the part a parser is still better at than a model:
 *
 *   - decide whether a page describes funding at all, so "Alumni" and
 *     "Privacy policy" never become scholarship records;
 *   - supply the provider identity, which is a property of the SOURCE and is
 *     therefore known without reading the page;
 *   - cut the page down to the sections that carry eligibility and benefits,
 *     which is what makes the LLM stage cheap and accurate.
 *
 * Everything interpretive is left to the LLM, where every fact it returns must
 * still carry a verbatim quote from the full page.
 */

export interface GenericSourceIdentity {
  sourceId: string;
  /** The awarding body. A property of the source, not a guess from the page. */
  providerName: string;
  providerType: ExtractionFile["scholarships"][number]["providerType"];
  /** ISO 3166-1 alpha-2 of the study destination, or null when multi-country. */
  country: string | null;
  /**
   * Restricts which pages may produce a scholarship record.
   *
   * Needed where one award is described across many pages. Chevening publishes
   * 198 /scholarship/<country>/ pages, but there is only ONE Chevening
   * Scholarship: those pages state which nationalities may apply and when
   * their round opens, not 198 separate awards. Emitting a record per page
   * would misrepresent the award and bury the real one under 197 near-copies.
   *
   * Pages outside the pattern are still parsed and still crawled, so their
   * content remains available as applicability evidence; they simply do not
   * become scholarships of their own.
   */
  emitWhen?: RegExp;
}

/** Page describes funding of some kind. */
const FUNDING_WORDS = /\b(scholarship|fellowship|bursar|grant|award|funding|stipend)/i;

/**
 * Substance test. A page that merely mentions the word "scholarship" in a
 * navigation menu is not a scholarship page; one that also discusses who may
 * apply, what it pays and when it closes is.
 */
const SUBSTANCE_WORDS = [
  /\beligib/i,
  /\bapply|application\b/i,
  /\bdeadline|closing date|closes\b/i,
  /\bcover(s|ed|age)?\b|\bfund(s|ed|ing)\b|\btuition\b|\ballowance\b|\bstipend\b/i,
  /\brequirement|criteria\b/i,
];

/** Pages that are structurally never an opportunity, whatever words they use. */
const NEVER_AN_OPPORTUNITY =
  /^(privacy|cookie|terms|contact|sitemap|accessibility|news|alumni|press|search results?|page not found|404)\b/i;

/** Headings whose sections are worth sending to the model. */
const RELEVANT_HEADING =
  /eligib|who can apply|requirement|criteria|benefit|financial|fund|cover|value|what .* offers?|allowance|stipend|tuition|deadline|closing|apply|application|selection|tenure|placement|countr|overview|about the (scholarship|programme|program|award)|duration|level|subject|field/i;

/**
 * Markdown produced from a CMS page carries the whole site around it. Content
 * starts at the first real heading and ends where the cookie banner begins -
 * every one of these sites appends a consent panel that would otherwise
 * dominate both the relevance test and the token count.
 */
function articleBody(markdown: string): string {
  const start = markdown.search(/^#{1,2}\s+\S/m);
  const body = start >= 0 ? markdown.slice(start) : markdown;
  const end = body.search(
    /^#{1,4}\s+(Cookie Settings|Privacy Overview|Cookies used|Follow (the )?|Subscribe|Share this|Related|Latest news)/mi,
  );
  return end > 0 ? body.slice(0, end) : body;
}

/** Strips markdown link syntax and emphasis so a heading reads as plain text. */
function cleanText(text: string): string {
  return text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

interface Section {
  heading: string;
  body: string;
}

function sections(body: string): Section[] {
  const out: Section[] = [];
  const matches = [...body.matchAll(/^(#{1,4})[ \t]+(.+?)[ \t]*$/gm)];
  for (let i = 0; i < matches.length; i += 1) {
    const heading = cleanText(matches[i][2]);
    const start = matches[i].index! + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : body.length;
    out.push({ heading, body: body.slice(start, end).trim() });
  }
  return out;
}

export function createGenericScholarshipParser(
  identity: GenericSourceIdentity,
): SourceParser {
  return {
    sourceId: identity.sourceId,

    matches(doc: SourceDocumentInput): boolean {
      return doc.sourceId === identity.sourceId;
    },

    parse(doc: SourceDocumentInput): ParserResult | null {
      const body = articleBody(doc.markdown);
      const filled: string[] = [];
      const unfilled: string[] = [];
      const warnings: string[] = [];

      const empty: ExtractionFile = {
        sourceId: identity.sourceId,
        sourceDocumentId: doc.sourceDocumentId,
        extractedBy: "manual",
        extractedAt: new Date().toISOString(),
        universities: [],
        programs: [],
        scholarships: [],
      };

      const titleMatch = body.match(/^#{1,2}\s+(.+)$/m);
      if (!titleMatch) {
        warnings.push("no heading found - not a content page");
        return { extraction: empty, coverage: { filled, unfilled, warnings } };
      }
      const name = cleanText(titleMatch[1]);
      if (!name) {
        warnings.push("heading resolved to empty text");
        return { extraction: empty, coverage: { filled, unfilled, warnings } };
      }

      if (NEVER_AN_OPPORTUNITY.test(name)) {
        warnings.push(`"${name}" is a site page, not an opportunity - skipped`);
        return { extraction: empty, coverage: { filled, unfilled, warnings } };
      }

      if (identity.emitWhen && !identity.emitWhen.test(doc.url)) {
        warnings.push(
          `"${name}" describes an award covered by another page on this source - no separate record`,
        );
        return { extraction: empty, coverage: { filled, unfilled, warnings } };
      }

      // Relevance gate. Without it, every "About us" and "Meet the team" page
      // on a scholarship site becomes a scholarship record.
      const substance = SUBSTANCE_WORDS.filter((re) => re.test(body)).length;
      if (!FUNDING_WORDS.test(body) || substance < 2) {
        warnings.push(
          `"${name}" does not describe funding in enough detail (${substance}/5 substance signals) - skipped`,
        );
        return { extraction: empty, coverage: { filled, unfilled, warnings } };
      }

      const relevant = sections(body).filter(
        (s) => RELEVANT_HEADING.test(s.heading) && s.body.length > 40,
      );

      // The opening paragraph, used as the record's own quote. Every record
      // needs one verbatim sentence from the page it came from.
      const lead = body
        .slice(titleMatch.index! + titleMatch[0].length)
        .split(/\n{2,}/)
        .map((p) => cleanText(p))
        .find((p) => p.length > 60 && !p.startsWith("|"));

      filled.push(
        "scholarships[0].name",
        "scholarships[0].providerName",
        "scholarships[0].applicationUrl",
        "scholarships[0].sourceUrl",
      );
      if (identity.country) filled.push("scholarships[0].country");
      if (lead) filled.push("scholarships[0].description");

      // Everything interpretive belongs to the LLM stage on these sources.
      unfilled.push(
        "scholarships[0].coverageType",
        "scholarships[0].eligibility[]",
        "scholarships[0].applicability",
      );
      if (relevant.length === 0) {
        warnings.push(
          `no eligibility or benefit sections matched on "${name}" - the model will see the whole page`,
        );
      }

      const extraction: ExtractionFile = {
        ...empty,
        scholarships: [
          {
            name,
            // Known from the source itself rather than read off the page: this
            // is a single-provider site, so the awarding body is not in doubt.
            providerName: identity.providerName,
            providerType: identity.providerType,
            country: identity.country,
            amount: null,
            amountCurrency: null,
            // Claimed only by the LLM, from the page's own wording.
            coverageType: "UNKNOWN",
            description: lead ? lead.slice(0, 1500) : null,
            applicationUrl: doc.url,
            deadlineText: null,
            isRenewable: null,
            discoveredFrom: null,
            discoveryUrl: null,
            officialSourceUrl: null,
            sourceUrl: doc.url,
            sourceQuote: lead ?? name,
            eligibility: [],
            applicability: [],
            deadlines: [],
          },
        ],
      };

      const focusParts = [`# ${name}`];
      if (lead) focusParts.push(lead.slice(0, 1200));
      for (const section of relevant) {
        focusParts.push(`## ${section.heading}\n${section.body.slice(0, 3000)}`);
      }

      return {
        extraction,
        coverage: { filled, unfilled, warnings },
        // When nothing matched, send a bounded slice of the page rather than
        // nothing at all - but never the whole thing, which is mostly chrome.
        focusText: relevant.length > 0 ? focusParts.join("\n\n") : body.slice(0, 12000),
      };
    },
  };
}
