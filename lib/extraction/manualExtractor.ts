import { readFile } from "node:fs/promises";
import path from "node:path";
import { ExtractionFileSchema, type ExtractionFile } from "./schemas";
import type { DataExtractor, SourceDocumentInput } from "./types";

const EXTRACTED_DIR = path.join(process.cwd(), "data", "extracted");

/**
 * The concrete operationalization of the manual extraction workflow:
 *   1. Crawl4AI produces data/raw/<sourceId>/<ts>/<hash>.md
 *   2. A person (today: Claude Code, reading the Markdown directly) hand-
 *      authors data/extracted/<sourceId>/<sourceDocumentId>.json following
 *      data/extracted/TEMPLATE.md
 *   3. This loader validates that file against the zod schema — a bad
 *      shape, a missing sourceUrl, or a fact with no sourceQuote fails
 *      loudly here, before anything reaches normalization/dedup/the DB.
 *
 * `extract()` ignores the passed-in markdown (the person already read it
 * when authoring the file); it's part of the interface only so a future
 * ClaudeExtractor can use it instead.
 */
export class ManualExtractor implements DataExtractor {
  async extract(doc: SourceDocumentInput): Promise<ExtractionFile | null> {
    const filePath = path.join(EXTRACTED_DIR, doc.sourceId, `${doc.sourceDocumentId}.json`);
    let raw: string;
    try {
      raw = await readFile(filePath, "utf-8");
    } catch {
      return null; // no hand-authored extraction exists yet for this document
    }
    const parsed = ExtractionFileSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      throw new Error(
        `Invalid extraction file ${filePath}:\n` +
          parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n"),
      );
    }
    return parsed.data;
  }
}

export async function loadManualExtraction(
  sourceId: string,
  sourceDocumentId: string,
): Promise<ExtractionFile | null> {
  return new ManualExtractor().extract({ sourceDocumentId, sourceId, url: "", markdown: "" });
}
