import type { ExtractionFile } from "./schemas";

export interface SourceDocumentInput {
  sourceDocumentId: string;
  sourceId: string;
  url: string;
  markdown: string;
  /** The page as crawled, when the crawl kept it. Tables with merged cells survive only here. */
  html?: string;
}

/**
 * Every extraction implementation — today's manual workflow, and a future
 * Claude-API-based one — honors this interface. Nothing downstream
 * (normalization, dedup, verification, DB loading) depends on which
 * implementation produced an ExtractionFile.
 */
export interface DataExtractor {
  extract(doc: SourceDocumentInput): Promise<ExtractionFile | null>;
}
