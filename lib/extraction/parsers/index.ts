import { daadScholarshipParser } from "./daadScholarship";
import { daadProgrammeParser } from "./daadProgramme";
import type { SourceParser } from "./types";
import type { SourceDocumentInput } from "../types";

/**
 * Every deterministic parser, in priority order. A document is handed to the
 * first parser whose `matches()` returns true.
 *
 * Adding a source means adding a parser here — nothing downstream
 * (normalization, dedup, verification, loading) changes, because parsers
 * emit the same ExtractionFile shape the manual and LLM extractors do.
 */
export const PARSERS: readonly SourceParser[] = [daadScholarshipParser, daadProgrammeParser];

export function findParser(doc: SourceDocumentInput): SourceParser | null {
  return PARSERS.find((p) => p.sourceId === doc.sourceId && p.matches(doc)) ?? null;
}

export type { SourceParser, ParserResult, ParserCoverage } from "./types";
