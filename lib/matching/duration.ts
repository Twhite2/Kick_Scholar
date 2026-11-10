/**
 * Converts a stated duration requirement into months, so it can be compared
 * against a student profile that stores months.
 *
 * The work-experience factor used to treat every requirement value as months.
 * It is not: of the 168 work-experience requirements in the catalogue, 100 are
 * stated in years and 14 in weeks. Comparing "5 years" as 5 months let a
 * student with six months' experience clear a five-year bar, and comparing
 * "18 weeks" as 18 months failed students who comfortably qualified. Wrong in
 * both directions, and invisible because the number itself looked reasonable.
 *
 * A unit that cannot be interpreted returns null rather than defaulting to
 * months. Not scoring a factor is honest; scoring it on a guessed scale is
 * not, and null already has a well-defined meaning here — the factor drops out
 * of the weighted average instead of penalising or rewarding.
 */

const MONTHS_PER: Record<string, number> = {
  year: 12,
  years: 12,
  yr: 12,
  yrs: 12,
  month: 1,
  months: 1,
  mo: 1,
  mos: 1,
  // Mean weeks per month (52 / 12), so "18 weeks" is not silently rounded to
  // four months when it is closer to four and a bit.
  week: 1 / 4.345,
  weeks: 1 / 4.345,
  wk: 1 / 4.345,
  wks: 1 / 4.345,
  day: 1 / 30.44,
  days: 1 / 30.44,
  // Matches the six-months-per-semester convention the DAAD programme parser
  // already uses for programme duration.
  semester: 6,
  semesters: 6,
};

/**
 * Academic credit units. The extractor sometimes files a credit prerequisite
 * ("180 ECTS in economics") as WORK_EXPERIENCE. It is a real requirement but
 * not a duration, and treating 180 as months would invent a fifteen-year
 * demand, so it is explicitly unscoreable here rather than mis-scored.
 */
const CREDIT_UNITS = /\b(ects|credits?|cp|credit points?)\b/i;

/** Finds a unit word next to the number in the page's own sentence. */
function unitFromText(value: number, quote: string | null): string | null {
  if (!quote) return null;
  if (CREDIT_UNITS.test(quote)) return null;
  // Look for "<number> <unit>", tolerating words like "at least" before it.
  const pattern = new RegExp(
    `${value}\\s*(?:\\+)?\\s*(year|years|yr|yrs|month|months|mo|mos|week|weeks|wk|wks|semester|semesters)\\b`,
    "i",
  );
  const near = quote.match(pattern);
  if (near) return near[1].toLowerCase();
  // No number-adjacent unit: fall back to a single unambiguous unit word in
  // the sentence. If it mentions more than one, it is not safe to pick.
  const mentioned = new Set(
    [...quote.matchAll(/\b(years?|months?|weeks?|semesters?)\b/gi)].map((m) =>
      m[1].toLowerCase().replace(/s$/, ""),
    ),
  );
  return mentioned.size === 1 ? [...mentioned][0] : null;
}

/**
 * Returns the requirement in months, or null when the scale cannot be
 * established.
 */
export function durationToMonths(
  value: number,
  unit: string | null,
  quote: string | null,
): number | null {
  if (!Number.isFinite(value)) return null;

  if (unit) {
    const key = unit.trim().toLowerCase();
    if (CREDIT_UNITS.test(key)) return null;
    const direct = MONTHS_PER[key];
    if (direct !== undefined) return value * direct;
    // Units arrive as free text ("German scale", "ECTS credits in economics"),
    // so also try the first recognisable word inside them.
    const word = key.match(/\b(years?|months?|weeks?|days?|semesters?)\b/);
    if (word) return value * MONTHS_PER[word[1]];
  }

  const inferred = unitFromText(value, quote);
  if (inferred) return value * MONTHS_PER[inferred];

  return null;
}

/** Renders a month count the way a person would say it. */
export function formatMonths(months: number): string {
  const rounded = Math.round(months);
  if (rounded < 12) return `${rounded} month${rounded === 1 ? "" : "s"}`;
  const years = months / 12;
  const wholeYears = Math.round(years * 10) / 10;
  return `${wholeYears} year${wholeYears === 1 ? "" : "s"}`;
}
