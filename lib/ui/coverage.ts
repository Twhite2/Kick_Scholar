import { formatMoney } from "./format";

/**
 * Scholarship coverage: the label on funding posters and the poster band
 * colour (docs/ui-remodel.md §9.1.6).
 */

export type Coverage =
  | "FULL_FUNDING"
  | "FULL_TUITION"
  | "PARTIAL_TUITION"
  | "VARIES"
  | "STIPEND"
  | "TRAVEL"
  | "UNKNOWN";

export const COVERAGE_LABEL: Record<Coverage, string> = {
  FULL_FUNDING: "Full funding",
  FULL_TUITION: "Full tuition",
  PARTIAL_TUITION: "Partial tuition",
  STIPEND: "Stipend",
  TRAVEL: "Travel only",
  VARIES: "Varies",
  UNKNOWN: "Amount not published",
};

/** For sentences: "{scholarship} can cover full tuition". */
export const COVERAGE_PHRASE: Record<Coverage, string | null> = {
  FULL_FUNDING: null, // handled as "can fully fund your studies"
  FULL_TUITION: "full tuition",
  PARTIAL_TUITION: "part of your tuition",
  STIPEND: "a living stipend",
  TRAVEL: "travel costs",
  VARIES: null,
  UNKNOWN: null,
};

export type PosterBand = "full" | "tuition" | "other";

export function posterBand(coverage: Coverage): PosterBand {
  if (coverage === "FULL_FUNDING") return "full";
  if (coverage === "FULL_TUITION" || coverage === "PARTIAL_TUITION") return "tuition";
  return "other";
}

export const POSTER_BAND_BG: Record<PosterBand, string> = {
  full: "bg-poster-full",
  tuition: "bg-poster-tuition",
  other: "bg-poster-other",
};

/** Bigger numbers for shorter strings, so "€1,400" and "SEK 12,000" both fit. */
export function amountFontSize(formatted: string): number {
  const n = formatted.length;
  if (n <= 5) return 52;
  if (n <= 7) return 46;
  if (n <= 10) return 38;
  return 30;
}

export function isCoverage(value: unknown): value is Coverage {
  return typeof value === "string" && value in COVERAGE_LABEL;
}

/**
 * The big figure on a funding poster and the line under it.
 *
 * Only what the record states: an amount when one is stored, "100%" when the
 * coverage itself is full tuition, otherwise "To be confirmed". The period
 * ("a month", "every year") is not in the data, so no per-line is invented
 * for amounts.
 */
export function posterAmount(input: {
  coverage: Coverage;
  amount: number | null;
  currency: string | null;
}): { text: string; size: number; per: string | null; confirmed: boolean } {
  if (input.amount !== null && input.amount > 0 && input.currency) {
    const text = formatMoney(input.amount, input.currency);
    return { text, size: amountFontSize(text), per: null, confirmed: true };
  }
  if (input.coverage === "FULL_TUITION") {
    return { text: "100%", size: amountFontSize("100%"), per: "of tuition", confirmed: true };
  }
  return { text: "To be confirmed", size: 30, per: null, confirmed: false };
}
