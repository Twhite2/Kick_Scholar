import path from "node:path";

const EXTRACTED_DIR = path.join(process.cwd(), "data", "extracted");

/**
 * A SourceDocument's id is `${sourceId}:${checksum}` (see
 * lib/crawler/runCrawlJob.ts), but `:` is reserved in Windows filenames —
 * NTFS reads `a:b` as an alternate data stream, so that name can never be
 * written or read back as a normal file. Extraction files on disk therefore
 * substitute `_`, which is why the real files are named
 * `src-bright-scholarship_b1ea….json` while their `sourceDocumentId` field
 * reads `src-bright-scholarship:b1ea…`.
 *
 * Both the reader (ManualExtractor) and any writer must go through this
 * function so the on-disk name and the in-file id can never drift apart
 * again — they previously did, and because ManualExtractor swallows read
 * errors and returns null, it failed silently for every file in the repo.
 */
export function sourceDocumentIdToFilename(sourceDocumentId: string): string {
  return `${sourceDocumentId.replaceAll(":", "_")}.json`;
}

/** Absolute path to the extraction file for one crawled document. */
export function extractionFilePath(sourceId: string, sourceDocumentId: string): string {
  return path.join(EXTRACTED_DIR, sourceId, sourceDocumentIdToFilename(sourceDocumentId));
}

export { EXTRACTED_DIR };
