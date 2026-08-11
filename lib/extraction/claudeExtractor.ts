import type { ExtractionFile } from "./schemas";
import type { DataExtractor, SourceDocumentInput } from "./types";

/**
 * Documented stub for a future Claude-API-based extractor. It implements
 * the same DataExtractor interface as ManualExtractor, so
 * lib/pipeline/loadExtractedToDb.ts and everything else downstream would
 * need zero changes to switch: both implementations produce the same
 * ExtractionFile shape (lib/extraction/schemas.ts), validated the same way.
 *
 * The real implementation would call the Claude API with the source
 * Markdown and a prompt derived directly from the zod schemas (so the model
 * is asked for exactly the fields ExtractionFileSchema expects, with the
 * same "null if not explicitly stated, always cite a sourceQuote" rule),
 * then run the same ExtractionFileSchema.safeParse validation ManualExtractor
 * does before anything is trusted.
 */
export class ClaudeExtractor implements DataExtractor {
  async extract(_doc: SourceDocumentInput): Promise<ExtractionFile | null> {
    throw new Error(
      "ClaudeExtractor is not implemented. The MVP pipeline uses ManualExtractor " +
        "(lib/extraction/manualExtractor.ts); wire this in once a Claude API key " +
        "and extraction prompt are available.",
    );
  }
}
