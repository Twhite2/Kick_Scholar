import type { ExtractionFile } from "../schemas";
import type { SourceDocumentInput } from "../types";

/**
 * What a deterministic parser could and could not establish from the page.
 *
 * This is the contract that makes the hybrid extractor cheap: the parser
 * fills everything a fixed page template guarantees, and `unfilled` tells
 * the orchestrator precisely what (if anything) still needs an LLM. A source
 * whose `unfilled` list comes back empty never costs an API call at all.
 */
export interface ParserCoverage {
  /** Dotted paths the parser established, e.g. "scholarships[0].deadlineText". */
  filled: string[];
  /**
   * Dotted paths the page states only as prose, needing interpretation
   * (e.g. turning "graduates, doctoral candidates and post-doctoral
   * researchers" into DegreeLevel enum values).
   */
  unfilled: string[];
  /** Anything structurally odd — an unexpected template, a missing section. */
  warnings: string[];
}

export interface ParserResult {
  extraction: ExtractionFile;
  coverage: ParserCoverage;
  /**
   * Just the substantive sections of the page, for the LLM stage.
   *
   * A crawled page is mostly cookie banner, navigation and footer — a DAAD
   * scholarship page is ~4,100 tokens of which only ~400 carry meaning.
   * Sending the whole thing made the model return almost nothing and invent
   * quotes; sending only these sections cut cost 3.5x AND improved output.
   * Quotes are still verified against the FULL page, so grounding is
   * unaffected.
   */
  focusText?: string;
}

/**
 * A per-source deterministic extractor. Runs before (and often instead of)
 * the LLM. Never guesses: a field the page does not state plainly is left
 * null and reported in `coverage.unfilled` rather than inferred.
 */
export interface SourceParser {
  /** The `Source.id` this parser understands. */
  readonly sourceId: string;
  /** Cheap check that this document really is the template we expect. */
  matches(doc: SourceDocumentInput): boolean;
  /** Returns null when `matches` was optimistic and the page isn't parseable. */
  parse(doc: SourceDocumentInput): ParserResult | null;
}
