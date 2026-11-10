import type { ExtractionFile } from "../schemas";
import type { SourceDocumentInput } from "../types";
import type { ParserResult, SourceParser } from "./types";

/**
 * Parses the EACEA Erasmus Mundus catalogue, where ONE page lists MANY
 * scholarships.
 *
 * Every other parser in this directory assumes one page describes one award.
 * That assumption produced a single Erasmus Mundus record from 30 crawled
 * pages: the generic parser took each page's heading ("Erasmus Mundus
 * Catalogue") as the scholarship name, and deduplication then correctly
 * collapsed 29 identical records into one. The catalogue's 218 funded joint
 * masters were sitting inside those pages, unread.
 *
 * The listing itself is rigidly structured, so this needs no model at all:
 *
 *     [Erasmus Mundus Joint Master in Multilingualism...](https://multidiverse.eu/)
 *     MultiDiverse - Project overview
 *     <https://erasmus-plus.ec.europa.eu/projects/search/details/101241136>
 *
 * which yields the programme's full name, its consortium website and its
 * Erasmus+ project record. EACEA hosts no detail page per programme — each
 * entry links out to the consortium — so the listing is the primary source and
 * following 218 external sites is deliberately not attempted.
 */

/**
 * A catalogue entry: a markdown link, then an acronym line ending in some
 * casing of "Project overview", then a bare project-platform URL.
 *
 * The acronym line is matched loosely because the site is inconsistent about
 * it ("Project overview" and "project overview" both occur).
 */
const ENTRY = new RegExp(
  [
    String.raw`\[([^\]]{10,300})\]\((https?://[^)\s]+)\)`, // name + consortium site
    String.raw`\s*\n\s*([^\n]{1,80}?)\s*[-–]\s*projects?\s+overview\s*`, // acronym
    // The project record appears two ways on the same page: as a bare
    // autolink, and as a markdown link whose text is an ellipsised URL.
    // Matching only the first shape silently dropped 65 of the 230 entries.
    String.raw`\n\s*(?:<(https?://[^>\s]+)>|\[[^\]]*\]\((https?://[^)\s]+)\))`,
  ].join(""),
  "gi",
);

/** The catalogue's own standing description of how its funding works. */
const CONTEXT_HEADING = /^##\s+Erasmus Mundus Joint Masters\s*$/m;

function cleanText(text: string): string {
  return (
    text
      .replace(/[*_`]/g, "")
      // The source's markdown conversion loses some punctuation, leaving
      // U+FFFD: "Choreomundus <?> Erasmus Mundus Master in Dance". Between
      // spaces it is always a dash in these titles, so restore one; anywhere
      // else drop it rather than guess at a letter. Storing the replacement
      // character itself would put a visible defect in a programme name.
      .replace(/\s�\s/g, " - ")
      .replace(/�/g, "")
      .replace(/\s+/g, " ")
      .trim()
  );
}

export class ErasmusMundusCatalogueParser implements SourceParser {
  readonly sourceId = "src-erasmus-mundus";

  matches(doc: SourceDocumentInput): boolean {
    return (
      doc.sourceId === this.sourceId &&
      /erasmus-mundus-catalogue/.test(doc.url) &&
      /projects?\s+overview/i.test(doc.markdown)
    );
  }

  parse(doc: SourceDocumentInput): ParserResult | null {
    const filled: string[] = [];
    const unfilled: string[] = [];
    const warnings: string[] = [];

    const entries = [...doc.markdown.matchAll(ENTRY)];
    if (entries.length === 0) {
      warnings.push("catalogue page matched but held no parseable entries");
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

    // The standing explanation of application timing and funding, quoted once
    // and shared by every entry on the page. It is the page's own wording, not
    // an inference.
    const contextIndex = doc.markdown.search(CONTEXT_HEADING);
    const context =
      contextIndex >= 0
        ? cleanText(doc.markdown.slice(contextIndex, contextIndex + 1200))
        : null;

    const seen = new Set<string>();
    const scholarships: ExtractionFile["scholarships"] = [];

    for (const match of entries) {
      const name = cleanText(match[1]);
      const consortiumUrl = match[2].trim();
      const acronym = cleanText(match[3]);
      // Group 4 is the autolink form, group 5 the markdown-link form.
      const projectUrl = (match[4] ?? match[5] ?? "").trim();
      if (!name || seen.has(name)) continue;
      seen.add(name);

      scholarships.push({
        name,
        providerName: "European Education and Culture Executive Agency (EACEA)",
        providerType: "GOVERNMENT",
        // Joint masters are delivered across several countries by design, so
        // there is no single destination country to claim.
        country: null,
        amount: null,
        amountCurrency: null,
        // The catalogue states that a programme is EU-funded but not what each
        // one covers; that varies by consortium and lives on their own site.
        coverageType: "UNKNOWN",
        description: acronym ? `${name} (${acronym})` : name,
        applicationUrl: consortiumUrl,
        deadlineText: null,
        isRenewable: null,
        discoveredFrom: null,
        discoveryUrl: null,
        // The Erasmus+ project record is the authoritative registration for
        // this programme, which is exactly what officialSourceUrl is for.
        officialSourceUrl: projectUrl,
        sourceUrl: doc.url,
        // The entry line as published, so the record cites the catalogue.
        sourceQuote: acronym ? `${name} ${acronym} - Project overview` : name,
        eligibility: [],
        applicability: [],
        deadlines: [],
      });
    }

    filled.push(
      `scholarships[].name x${scholarships.length}`,
      "scholarships[].applicationUrl",
      "scholarships[].officialSourceUrl",
      "scholarships[].providerName",
    );
    // Per-programme eligibility lives on each consortium's own website, which
    // this source does not carry and this crawl does not follow.
    unfilled.push("scholarships[].eligibility[]", "scholarships[].coverageType");

    return {
      extraction: {
        sourceId: this.sourceId,
        sourceDocumentId: doc.sourceDocumentId,
        extractedBy: "manual",
        extractedAt: new Date().toISOString(),
        universities: [],
        programs: [],
        scholarships,
      },
      coverage: { filled, unfilled, warnings },
      // Only the shared context is worth a model call; the entries themselves
      // are already fully parsed.
      focusText: context ?? undefined,
    };
  }
}

export const erasmusMundusCatalogueParser = new ErasmusMundusCatalogueParser();
