import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import {
  LlmScholarshipFieldsSchema,
  LlmProgramFieldsSchema,
  type LlmScholarshipFields,
  type LlmProgramFields,
} from "./outputSchemas";
import { filterByQuote, isPlausibleNumeric, type QuoteRejection } from "./quoteGuard";
import { normaliseGradeDirections } from "./gradeScale";

/**
 * Fills the prose fields deterministic parsers cannot: eligibility rules,
 * applicability rules, and admission requirements.
 *
 * This is an *enricher*, not a replacement extractor. Parsers own everything
 * a fixed page template guarantees (names, degree level, tuition, dates);
 * this only handles what is genuinely stated as prose. That split is why the
 * bill is single-digit dollars rather than hundreds.
 *
 * Two safeguards make a cheap model acceptable here:
 *   - Structured Outputs enforce the response schema server-side.
 *   - Every returned sub-fact must carry a quote that literally appears in
 *     the page (quoteGuard); anything else is dropped, never stored.
 */

const DEFAULT_MODEL = process.env.EXTRACTION_MODEL ?? "gpt-4o-mini";

/** Pages are sent whole; this only guards against a pathological outlier. */
const MAX_INPUT_CHARS = 120_000;

const SYSTEM_PROMPT = `You extract structured facts from university and scholarship web pages.

ABSOLUTE RULES — these override everything else:
1. Extract ONLY what the page explicitly states. Never infer, complete or
   supply anything from general knowledge.
2. Every fact needs a sourceQuote copied VERBATIM from the page — exact
   characters. A paraphrase is treated as a fabrication and discarded.
3. If the page does not state something, return an empty array or the
   explicit "unknown" value. Returning nothing is always better than
   returning a plausible guess.
4. Do not translate. Quote in the language the page uses.

The page is Markdown converted from HTML, so it contains navigation, cookie
banners and footers. Ignore them and extract only the page's own subject.`;

export interface LlmUsage {
  model: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  /** USD, using the model's published rates. */
  costUsd: number;
}

/** $ per 1M tokens: [input, cachedInput, output]. */
const PRICING: Record<string, [number, number, number]> = {
  "gpt-4o-mini": [0.15, 0.075, 0.6],
  "gpt-5-nano": [0.05, 0.005, 0.4],
  "gpt-5.4-nano": [0.2, 0.02, 1.25],
  "gpt-5.4-mini": [0.75, 0.075, 4.5],
  "gpt-4o": [2.5, 1.25, 10.0],
};

function priceFor(
  model: string,
  inputTokens: number,
  cachedTokens: number,
  outputTokens: number,
): number {
  const [pin, pcached, pout] = PRICING[model] ?? PRICING["gpt-4o-mini"];
  const fresh = Math.max(inputTokens - cachedTokens, 0);
  return (fresh * pin + cachedTokens * pcached + outputTokens * pout) / 1e6;
}

export interface EnrichResult<T> {
  fields: T | null;
  usage: LlmUsage;
  /** Facts the model returned that failed the verbatim-quote check. */
  droppedQuotes: Array<{ quote: string; reason: QuoteRejection }>;
  /** Grade comparisons flipped to match the German scale's direction. */
  gradeDirectionsCorrected?: number;
  error?: string;
}

let cachedClient: OpenAI | null = null;
function client(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is not set — add it to .env before running LLM extraction.",
    );
  }
  cachedClient ??= new OpenAI();
  return cachedClient;
}

async function callModel<T>(
  schema: import("zod").ZodType<T>,
  schemaName: string,
  instruction: string,
  focusText: string,
  model: string,
): Promise<{ parsed: T | null; usage: LlmUsage; error?: string }> {
  const page = focusText.slice(0, MAX_INPUT_CHARS);
  try {
    const response = await client().responses.parse({
      model,
      // Stable prefix first so the provider can cache it across pages; the
      // volatile page body goes last.
      instructions: `${SYSTEM_PROMPT}\n\n${instruction}`,
      input: page,
      text: { format: zodTextFormat(schema, schemaName) },
    });

    const u = response.usage;
    const inputTokens = u?.input_tokens ?? 0;
    const cachedInputTokens = u?.input_tokens_details?.cached_tokens ?? 0;
    const outputTokens = u?.output_tokens ?? 0;

    return {
      parsed: (response.output_parsed as T) ?? null,
      usage: {
        model,
        inputTokens,
        cachedInputTokens,
        outputTokens,
        costUsd: priceFor(model, inputTokens, cachedInputTokens, outputTokens),
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      parsed: null,
      usage: { model, inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, costUsd: 0 },
      error: message,
    };
  }
}

/** Extracts eligibility + applicability + coverage for one scholarship page. */
export async function enrichScholarship(
  markdown: string,
  opts: { model?: string; focusText?: string } = {},
): Promise<EnrichResult<LlmScholarshipFields>> {
  const model = opts.model ?? DEFAULT_MODEL;
  // Send the relevant sections when the caller can identify them, but always
  // verify quotes against the FULL page. A raw DAAD page is ~6.3k tokens of
  // which the great majority is cookie banner, navigation and footer; feeding
  // that whole made the model return almost nothing and invent quotes. The
  // parser already knows where the substantive sections are, so this is the
  // hybrid split doing real work: cheaper input AND better signal.
  const sent = opts.focusText?.trim() ? opts.focusText : markdown;
  const { parsed, usage, error } = await callModel(
    LlmScholarshipFieldsSchema,
    "scholarship_fields",
    "Extract this scholarship's eligibility rules, where the funding may be used, and what it covers.",
    sent,
    model,
  );
  if (!parsed) return { fields: null, usage, droppedQuotes: [], error };

  // Anything the model could not ground in the page is discarded here.
  // Numeric thresholds are additionally sanity-checked: a quote proves the
  // sentence exists, not that the number was read correctly.
  const plausible = parsed.eligibility.filter((e) =>
    isPlausibleNumeric(e.criterionType, e.numericValue),
  );
  const implausible = parsed.eligibility.length - plausible.length;
  const elig = filterByQuote(plausible, markdown);
  const appl = filterByQuote(parsed.applicability, markdown);

  return {
    fields: {
      ...parsed,
      eligibility: elig.kept,
      applicability: appl.kept,
    },
    usage,
    droppedQuotes: [
      ...elig.dropped.map((d) => ({ quote: d.item.sourceQuote, reason: d.reason })),
      ...appl.dropped.map((d) => ({ quote: d.item.sourceQuote, reason: d.reason })),
      ...Array.from({ length: implausible }, () => ({
        quote: "(numeric threshold outside plausible range)",
        reason: "not-in-source" as QuoteRejection,
      })),
    ],
  };
}

/** Extracts admission requirements + field category for one programme page. */
export async function enrichProgram(
  markdown: string,
  opts: { model?: string; focusText?: string } = {},
): Promise<EnrichResult<LlmProgramFields>> {
  const model = opts.model ?? DEFAULT_MODEL;
  const sent = opts.focusText?.trim() ? opts.focusText : markdown;
  const { parsed, usage, error } = await callModel(
    LlmProgramFieldsSchema,
    "program_fields",
    "Extract this degree programme's admission requirements and its broad subject area.",
    sent,
    model,
  );
  if (!parsed) return { fields: null, usage, droppedQuotes: [], error };

  const reqs = filterByQuote(parsed.requirements, markdown);
  // A verbatim quote can still carry an inverted comparison: German grades run
  // 1.0 (best) to 4.0, so "at least 2.7" is numerically <= 2.7. Corrected here
  // rather than at match time, so the stored row means what the page means.
  const graded = normaliseGradeDirections(reqs.kept);
  return {
    fields: { ...parsed, requirements: graded.requirements },
    usage,
    gradeDirectionsCorrected: graded.corrected,
    droppedQuotes: reqs.dropped.map((d) => ({ quote: d.item.sourceQuote, reason: d.reason })),
  };
}
