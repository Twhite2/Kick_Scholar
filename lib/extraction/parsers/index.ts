import { daadScholarshipParser } from "./daadScholarship";
import { daadProgrammeParser } from "./daadProgramme";
import { brightScholarshipParser } from "./brightScholarship";
import { createGenericScholarshipParser } from "./genericScholarshipPage";
import { erasmusMundusCatalogueParser } from "./erasmusMundusCatalogue";
import type { SourceParser } from "./types";
import type { SourceDocumentInput } from "../types";

/**
 * The curated government sources publish prose, not fielded templates, so they
 * share one generic parser rather than having five near-identical ones. The
 * provider identity is passed in because it is a property of the source, known
 * without reading any page - which is also why it is not a fabrication to
 * state it.
 */
const CURATED_SOURCES: readonly SourceParser[] = [
  createGenericScholarshipParser({
    sourceId: "src-chevening",
    providerName: "Chevening (UK Foreign, Commonwealth & Development Office)",
    providerType: "GOVERNMENT",
    country: "GB",
    // One award, 198 country pages. Only the award's own pages become records;
    // Nigeria is kept because it is this product's primary audience and its
    // page carries that round's dates and partner awards.
    emitWhen: /chevening\.org\/(scholarships(\/|$)|fellowship|scholarship\/nigeria)/,
  }),
  createGenericScholarshipParser({
    sourceId: "src-commonwealth",
    providerName: "Commonwealth Scholarship Commission in the UK",
    providerType: "GOVERNMENT",
    country: "GB",
  }),
  createGenericScholarshipParser({
    sourceId: "src-mext",
    providerName: "Ministry of Education, Culture, Sports, Science and Technology (MEXT), Japan",
    providerType: "GOVERNMENT",
    country: "JP",
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
  ...CURATED_SOURCES,
];

export function findParser(doc: SourceDocumentInput): SourceParser | null {
  return PARSERS.find((p) => p.sourceId === doc.sourceId && p.matches(doc)) ?? null;
}

export type { SourceParser, ParserResult, ParserCoverage } from "./types";
