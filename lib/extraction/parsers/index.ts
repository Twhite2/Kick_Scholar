import { daadScholarshipParser } from "./daadScholarship";
import { daadProgrammeParser } from "./daadProgramme";
import { brightScholarshipParser } from "./brightScholarship";
import { createGenericScholarshipParser } from "./genericScholarshipPage";
import { erasmusMundusCatalogueParser } from "./erasmusMundusCatalogue";
import { mextScholarshipsParser } from "./mextScholarships";
import type { SourceParser } from "./types";
import type { SourceDocumentInput } from "../types";

/**
 * The curated government sources publish prose, not fielded templates, so they
 * share one generic parser rather than having five near-identical ones. The
 * provider identity is passed in because it is a property of the source, known
 * without reading any page - which is also why it is not a fabrication to
 * state it.
 */
/**
 * The pages of each curated source that describe an award. Everything else on
 * those sites (overviews, eligibility explainers, application timelines, host,
 * alumni and policy pages, country pages, news) is still crawled and kept as
 * evidence, but never becomes a scholarship of its own: a whole site captured
 * page by page put "About us", "Accommodation" and a 404 page in the
 * catalogue as scholarships.
 *
 * The loader and the record cleanup use the same patterns (isAwardPage), so
 * an old extraction file cannot bring such a page back.
 */
export const AWARD_PAGES: Readonly<Record<string, RegExp>> = {
  // One Chevening Scholarship and its named fellowships. The 198 country pages,
  // "who can apply", "find a course" and the timeline describe that same award.
  "src-chevening": /^https?:\/\/(www\.)?chevening\.org\/(scholarships|fellowship\/[^/]+)\/?$/,
  // Each Commonwealth award has its own page; pages for host organisations,
  // nominators, alumni and current scholars are not awards.
  "src-commonwealth":
    /^https?:\/\/cscuk\.fcdo\.gov\.uk\/(scholarships\/commonwealth-(?![^/]*host)[^/]+|apply\/(commonwealth-professional-fellowships|gambia-scholarships|new-zealand))\/?$/,
  // MEXT's own page, which the MEXT parser reads into its seven types. The
  // rest of Study in Japan is guidance for students (fees, housing, work).
  "src-mext": /^https?:\/\/www\.studyinjapan\.go\.jp\/en\/planning\/scholarships\/mext-scholarships\/?$/,
  // The full-time, short-term and joint programme pages, and the IsDB joint
  // programme's call; yearly calls of the main programme are merged into it.
  "src-turkiye-burslari":
    /^https?:\/\/(www\.)?turkiyeburslari\.gov\.tr\/(fulltimeprograms|shorttermprograms|partneredprograms|announcements\/ytb-islamic-development-bank[^/]*)\/?$/,
};

/** True when a page of this source may become a scholarship record. Sources without a list allow every page. */
export function isAwardPage(sourceId: string, url: string): boolean {
  const pattern = AWARD_PAGES[sourceId];
  return pattern ? pattern.test(url) : true;
}

const CURATED_SOURCES: readonly SourceParser[] = [
  createGenericScholarshipParser({
    sourceId: "src-chevening",
    providerName: "Chevening (UK Foreign, Commonwealth & Development Office)",
    providerType: "GOVERNMENT",
    country: "GB",
    // One award, 198 country pages: only the award's own pages become records.
    // The Nigeria page's dates and partner awards are kept as evidence on the
    // Chevening Scholarship record (scripts/cleanup-scholarship-records.ts).
    emitWhen: AWARD_PAGES["src-chevening"],
  }),
  createGenericScholarshipParser({
    sourceId: "src-commonwealth",
    providerName: "Commonwealth Scholarship Commission in the UK",
    providerType: "GOVERNMENT",
    country: "GB",
    emitWhen: AWARD_PAGES["src-commonwealth"],
  }),
  createGenericScholarshipParser({
    sourceId: "src-mext",
    providerName: "Ministry of Education, Culture, Sports, Science and Technology (MEXT), Japan",
    providerType: "GOVERNMENT",
    country: "JP",
    emitWhen: AWARD_PAGES["src-mext"],
  }),
  createGenericScholarshipParser({
    sourceId: "src-erasmus-mundus",
    providerName: "European Education and Culture Executive Agency (EACEA)",
    providerType: "GOVERNMENT",
    // Joint masters span several countries by design, so no single destination.
    country: null,
  }),
  createGenericScholarshipParser({
    sourceId: "src-turkiye-burslari",
    providerName: "Turkiye Burslari (Presidency for Turks Abroad and Related Communities)",
    providerType: "GOVERNMENT",
    country: "TR",
    emitWhen: AWARD_PAGES["src-turkiye-burslari"],
  }),
];

/**
 * Every deterministic parser, in priority order. A document is handed to the
 * first parser whose `matches()` returns true.
 *
 * Adding a source means adding a parser here — nothing downstream
 * (normalization, dedup, verification, loading) changes, because parsers
 * emit the same ExtractionFile shape the manual and LLM extractors do.
 */
export const PARSERS: readonly SourceParser[] = [
  daadScholarshipParser,
  daadProgrammeParser,
  brightScholarshipParser,
  erasmusMundusCatalogueParser,
  // Before the generic parser, which would read MEXT's page as one award.
  mextScholarshipsParser,
  ...CURATED_SOURCES,
];

export function findParser(doc: SourceDocumentInput): SourceParser | null {
  return PARSERS.find((p) => p.sourceId === doc.sourceId && p.matches(doc)) ?? null;
}

export type { SourceParser, ParserResult, ParserCoverage } from "./types";
