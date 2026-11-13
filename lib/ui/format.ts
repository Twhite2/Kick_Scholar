/**
 * Formatting for everything a student reads: money, dates, countdowns,
 * durations and counts (docs/ui-remodel.md §14.2).
 *
 * Countdowns and "today" are computed in Africa/Lagos, where most students
 * are, so a deadline never reads "Closes tomorrow" on the day itself because
 * the server happens to run in UTC.
 */

export const TIME_ZONE = "Africa/Lagos";
const LOCALE = "en-GB";
const DAY_MS = 86_400_000;

type DateInput = Date | string | number;

function toDate(d: DateInput): Date {
  return d instanceof Date ? d : new Date(d);
}

const partsFormatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
});

function lagosParts(d: Date): { year: number; month: number; day: number; hour: number } {
  const parts = partsFormatter.formatToParts(d);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour") };
}

/** Days since the epoch for the Lagos calendar date of `d`. */
function lagosDayNumber(d: Date): number {
  const { year, month, day } = lagosParts(d);
  return Math.round(Date.UTC(year, month - 1, day) / DAY_MS);
}

/** Whole calendar days from `now` to `date` in Lagos. 0 = today, 1 = tomorrow. */
export function daysUntil(date: DateInput, now: DateInput = new Date()): number {
  return lagosDayNumber(toDate(date)) - lagosDayNumber(toDate(now));
}

export function isSameYear(date: DateInput, now: DateInput = new Date()): boolean {
  return lagosParts(toDate(date)).year === lagosParts(toDate(now)).year;
}

/** "2 Jan 2027", or "2 Jan" in the current year. */
export function formatDate(date: DateInput, now: DateInput = new Date()): string {
  const d = toDate(date);
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "short",
    ...(isSameYear(d, now) ? {} : { year: "numeric" }),
  }).format(d);
}

/** "3 Nov 2026" — always with the year, for provenance lines. */
export function formatFullDate(date: DateInput): string {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(toDate(date));
}

/** "Sun 22 Nov" — ticket stubs. */
export function formatTicketDate(date: DateInput): string {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(toDate(date));
}

/** "Closes in 53 days", "Closes tomorrow", "Closes today". */
export function closesIn(days: number): string {
  if (days < 0) return "Closed";
  if (days === 0) return "Closes today";
  if (days === 1) return "Closes tomorrow";
  return `Closes in ${formatCount(days)} days`;
}

/** Billboard deadline line. */
export function applicationsCloseLine(date: DateInput | null | undefined, now: DateInput = new Date()): string {
  if (!date) return "Deadline not published yet";
  const days = daysUntil(date, now);
  if (days < 0) return "Applications have closed";
  if (days === 0) return "Applications close today";
  if (days === 1) return "Applications close tomorrow";
  return `Applications close ${formatDate(date, now)}, in ${formatCount(days)} days`;
}

/** Ticket stub: big value plus an optional label underneath. */
export function ticketCountdown(days: number): { value: string; label: string | null } {
  if (days <= 0) return { value: "Today", label: null };
  if (days === 1) return { value: "1", label: "day left" };
  return { value: formatCount(days), label: "days left" };
}

/** Deadlines inside this many days are urgent: red text, red stub. */
export const URGENT_DAYS = 14;

export function isUrgent(days: number | null | undefined): boolean {
  return days !== null && days !== undefined && days >= 0 && days <= URGENT_DAYS;
}

// ---------------------------------------------------------------------------
// Numbers and money
// ---------------------------------------------------------------------------

const countFormatter = new Intl.NumberFormat(LOCALE);

/** "1,412" */
export function formatCount(n: number): string {
  return countFormatter.format(n);
}

/** "1 programme", "2 programmes", "1,412 programmes". */
export function plural(n: number, one: string, many: string = `${one}s`): string {
  return `${formatCount(n)} ${n === 1 ? one : many}`;
}

/** Currencies printed as their code: "SEK 12,000" rather than "kr12,000". */
const CODE_CURRENCIES = new Set(["SEK", "NOK", "DKK", "CHF"]);
/** en-GB prints "NGN" and "US$" as the plain symbol; these read better narrow. */
const NARROW_CURRENCIES = new Set(["NGN", "USD"]);

/** "€1,400", "£9,250", "₦450,000", "SEK 12,000". */
export function formatMoney(value: number, currency: string | null | undefined): string {
  const code = (currency ?? "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) return formatCount(Math.round(value));
  try {
    return new Intl.NumberFormat(LOCALE, {
      style: "currency",
      currency: code,
      currencyDisplay: CODE_CURRENCIES.has(code) ? "code" : NARROW_CURRENCIES.has(code) ? "narrowSymbol" : "symbol",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
      .format(value)
      .replace(/ /g, " ");
  } catch {
    return `${formatCount(Math.round(value))} ${code}`;
  }
}

// ---------------------------------------------------------------------------
// Durations and time of day
// ---------------------------------------------------------------------------

/** "2 years", "1 year", "18 months". */
export function formatDuration(months: number | null | undefined): string | null {
  if (!months || months <= 0) return null;
  if (months % 12 === 0) return plural(months / 12, "year");
  return plural(months, "month");
}

/**
 * Length and study mode as one fact: "2 years, full-time", "1 year
 * full-time, part-time available", "Part-time". Where a course runs both
 * ways, the stated length is the full-time one. `short` fits a poster line:
 * "1 year, full or part-time".
 */
export function formatStudyLength(
  months: number | null | undefined,
  mode: string | null | undefined,
  { short = false }: { short?: boolean } = {},
): string | null {
  const length = formatDuration(months);
  const m = mode?.toLowerCase() ?? null;
  if (m === "full-time") return length ? `${length}, full-time` : "Full-time";
  if (m === "full-time or part-time") {
    if (short) return length ? `${length}, full or part-time` : "Full or part-time";
    return length ? `${length} full-time, part-time available` : "Full-time or part-time";
  }
  if (m === "part-time") return length ? `${length}, part-time` : "Part-time";
  return length;
}

export function greeting(now: DateInput = new Date()): "morning" | "afternoon" | "evening" {
  const { hour } = lagosParts(toDate(now));
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

/** Rail pill: "since Friday" within a week, otherwise "since 2 Nov". */
export function sinceLabel(previous: DateInput, now: DateInput = new Date()): string {
  const p = toDate(previous);
  const days = daysUntil(now, p);
  if (days <= 0) return "since earlier today";
  if (days < 7) {
    const weekday = new Intl.DateTimeFormat(LOCALE, { timeZone: TIME_ZONE, weekday: "long" }).format(p);
    return `since ${weekday}`;
  }
  return `since ${formatDate(p, now)}`;
}

/** Lower-case the first letter: "Book an IELTS date" -> "book an IELTS date". */
export function lowerFirst(s: string): string {
  if (!s) return s;
  const second = s.charAt(1);
  // Keep acronyms intact: "IELTS score" stays "IELTS score".
  if (second && second === second.toUpperCase() && /[A-Z]/.test(second)) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/** Truncate at a word boundary, for engine explanations shown in tight spots. */
export function truncateWords(s: string, max = 80): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:—-]+$/, "")}…`;
}
