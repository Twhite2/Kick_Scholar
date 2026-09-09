/**
 * Enforces the codebase's core anti-hallucination invariant: every extracted
 * sub-fact must carry a `sourceQuote` that genuinely appears in the source
 * page.
 *
 * Structured Outputs guarantee a `sourceQuote` *string exists*; they cannot
 * guarantee it is real. A model that paraphrases ("must be under 40") where
 * the page said ("Be Under the age of 40 for Degree programs") produces a
 * record that passes every schema check and is still unciteable. This module
 * is what makes that mechanically impossible — and it is why a cheaper model
 * is a safe choice here: its hallucinations are dropped, not stored.
 */

/** Shortest string we accept as evidence — below this a "quote" proves nothing. */
const MIN_QUOTE_LENGTH = 15;
/** Longest — beyond this the model is dumping a passage, not citing one. */
const MAX_QUOTE_LENGTH = 600;

/**
 * Normalizes both sides identically before comparison so that formatting
 * differences (markdown emphasis, smart quotes, collapsed whitespace, NBSP)
 * never reject an otherwise-verbatim quote.
 */
export function normalizeForQuoteMatch(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[   ]/g, " ") // non-breaking spaces
    .replace(/[‘’‛]/g, "'") // smart single quotes
    .replace(/[“”]/g, '"') // smart double quotes
    .replace(/[‐-―]/g, "-") // dashes
    .replace(/[*_`]/g, "") // markdown emphasis
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export type QuoteRejection = "too-short" | "too-long" | "not-in-source";

export interface QuoteCheck {
  ok: boolean;
  reason?: QuoteRejection;
}

export function checkQuote(quote: string, sourceText: string): QuoteCheck {
  const q = normalizeForQuoteMatch(quote);
  if (q.length < MIN_QUOTE_LENGTH) return { ok: false, reason: "too-short" };
  if (q.length > MAX_QUOTE_LENGTH) return { ok: false, reason: "too-long" };
  if (!normalizeForQuoteMatch(sourceText).includes(q)) {
    return { ok: false, reason: "not-in-source" };
  }
  return { ok: true };
}

export interface QuoteFilterResult<T> {
  kept: T[];
  dropped: Array<{ item: T; reason: QuoteRejection }>;
}

/**
 * Drops sub-facts whose quote cannot be found in the source.
 *
 * Deliberately drops rather than repairs: a quote is evidence, and inventing
 * or "fixing" one from the model's own output would defeat the entire point.
 * Every drop is reported so a source that fails often is visible rather than
 * quietly thinned out.
 */
export function filterByQuote<T extends { sourceQuote: string }>(
  items: readonly T[],
  sourceText: string,
): QuoteFilterResult<T> {
  const kept: T[] = [];
  const dropped: Array<{ item: T; reason: QuoteRejection }> = [];
  for (const item of items) {
    const check = checkQuote(item.sourceQuote, sourceText);
    if (check.ok) kept.push(item);
    else dropped.push({ item, reason: check.reason! });
  }
  return { kept, dropped };
}


/**
 * Plausibility bounds for numeric eligibility criteria.
 *
 * The quote guard proves a fact came from the page; it cannot tell whether
 * the model read the number correctly. Observed in practice: "MAX_AGE LT 6"
 * on a postgraduate art scholarship, where the page's age limit was nowhere
 * near 6. A nonsense threshold is worse than a missing one, because the
 * matching engine will happily hard-fail a qualified student against it.
 */
const NUMERIC_BOUNDS: Record<string, [number, number]> = {
  // Scholarship age limits in the real world sit roughly between these.
  MAX_AGE: [15, 100],
  // GPA scales vary (4.0, 5.0, German 1-6), so this is deliberately loose.
  MIN_GPA: [0, 100],
  // Months of work experience; 50 years is already absurd.
  WORK_EXPERIENCE: [0, 600],
};

export function isPlausibleNumeric(
  criterionType: string,
  value: number | null,
): boolean {
  if (value === null) return true;
  const bounds = NUMERIC_BOUNDS[criterionType];
  if (!bounds) return true;
  return value >= bounds[0] && value <= bounds[1];
}
