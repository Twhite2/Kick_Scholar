/**
 * Deadline dates from the wording sources actually use.
 *
 * DAAD and most scholarship pages state annual deadlines without a year
 * ("until 15 July", "1 April - 15 May", "1 March and 1 September of each
 * year"). Those are resolved to their next occurrence on or after a reference
 * date, and the original wording is kept as dateText so it can always be
 * shown and re-resolved. Text with an explicit year is taken literally.
 * Nothing here guesses a day or month that the text does not state.
 */

const MONTHS: Record<string, number> = {
  january: 0, jan: 0,
  february: 1, feb: 1,
  march: 2, mar: 2,
  april: 3, apr: 3,
  may: 4,
  june: 5, jun: 5,
  july: 6, jul: 6,
  august: 7, aug: 7,
  september: 8, sep: 8, sept: 8,
  october: 9, oct: 9,
  november: 10, nov: 10,
  december: 11, dec: 11,
};

const MONTH_NAMES = "January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept|Sep|Oct|Nov|Dec";
const DAY_MONTH = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\.?\\s+(${MONTH_NAMES})\\b\\.?(?:,?\\s+(\\d{4}))?`, "gi");
const MONTH_DAY = new RegExp(`\\b(${MONTH_NAMES})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s+(\\d{4}))?`, "gi");
/** German-style "01.10.2026"; only with a four-digit year, where day-month order is certain. */
const NUMERIC = /\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/g;

export interface FoundDate {
  day: number;
  /** 0-based month. */
  month: number;
  year: number | null;
  index: number;
  text: string;
}

function valid(day: number, month: number, year: number): boolean {
  const d = new Date(Date.UTC(year, month, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month && d.getUTCDate() === day;
}

/** Every "15 July", "15 July 2027" or "July 15, 2027" in the text, in order. */
export function findDates(text: string): FoundDate[] {
  const out: FoundDate[] = [];
  for (const m of text.matchAll(DAY_MONTH)) {
    const day = Number(m[1]);
    const month = MONTHS[m[2].toLowerCase()];
    const year = m[3] ? Number(m[3]) : null;
    if (month === undefined || !valid(day, month, year ?? 2028)) continue;
    out.push({ day, month, year, index: m.index ?? 0, text: m[0] });
  }
  for (const m of text.matchAll(MONTH_DAY)) {
    const month = MONTHS[m[1].toLowerCase()];
    const day = Number(m[2]);
    const year = m[3] ? Number(m[3]) : null;
    if (month === undefined || !valid(day, month, year ?? 2028)) continue;
    // Skip overlaps with a day-month match already taken ("15 July 2027").
    if (out.some((o) => Math.abs(o.index - (m.index ?? 0)) < 4)) continue;
    out.push({ day, month, year, index: m.index ?? 0, text: m[0] });
  }
  for (const m of text.matchAll(NUMERIC)) {
    const day = Number(m[1]);
    const month = Number(m[2]) - 1;
    const year = Number(m[3]);
    if (!valid(day, month, year)) continue;
    out.push({ day, month, year, index: m.index ?? 0, text: m[0] });
  }
  return out.sort((a, b) => a.index - b.index);
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** The date a found day and month stand for: literal with a year, else the next occurrence on or after `asOf`. */
export function resolveDate(found: Pick<FoundDate, "day" | "month" | "year">, asOf: Date): Date {
  if (found.year !== null) return new Date(Date.UTC(found.year, found.month, found.day));
  const from = startOfUtcDay(asOf);
  let year = from.getUTCFullYear();
  // 29 February only exists in leap years; step until it does.
  for (let i = 0; i < 8; i++) {
    if (valid(found.day, found.month, year)) {
      const candidate = new Date(Date.UTC(year, found.month, found.day));
      if (candidate >= from) return candidate;
    }
    year += 1;
  }
  return new Date(Date.UTC(year, found.month, Math.min(found.day, 28)));
}

/** True when the wording names a year, so the date is fixed rather than annual. */
export function hasExplicitYear(text: string | null | undefined): boolean {
  return Boolean(text && /\b(19|20)\d{2}\b/.test(text));
}

/**
 * Annual deadlines move to their next occurrence once they pass; dated ones
 * never do. Used when loading and by the yearly refresh.
 */
export function rollForward(date: Date, dateText: string | null | undefined, now: Date): Date {
  if (hasExplicitYear(dateText)) return date;
  const today = startOfUtcDay(now);
  if (date >= today) return date;
  const found = findDates(dateText ?? "");
  const last = found[found.length - 1];
  if (!last) return date;
  return resolveDate({ day: last.day, month: last.month, year: null }, today);
}

// ---------------------------------------------------------------------------
// DAAD "Application periods" block
// ---------------------------------------------------------------------------

export interface PeriodDeadline {
  /** ISO date-time at 00:00 UTC. */
  date: string;
  /** The source's own wording, e.g. "until 15 July" or "1 April - 15 May". */
  dateText: string;
  /** "Winter semester", "Summer semester (non-EU applicants)", or null. */
  intake: string | null;
  sourceQuote: string;
}

export interface ApplicationPeriods {
  found: boolean;
  deadlines: PeriodDeadline[];
  /** "This programme has no deadline listed." or "check the website" wording. */
  note: string | null;
}

function applicantGroup(members: string[]): string | null {
  const g = members.join(" ").toLowerCase();
  if (!g || /all countries/.test(g)) return null;
  if (/non-eu|non eu|third[- ]countr|outside the eu/.test(g)) return "non-EU applicants";
  if (/\beu\b|eu countries|european union|\beea\b|iceland|norway|liechtenstein|switzerland/.test(g)) return "EU applicants";
  return `applicants from ${members.join(", ")}`;
}

function stripLinks(s: string): string {
  return s.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/<https?:[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

/** Links, list bullets and bold/italic markers out, for wording shown to students. */
function plainText(s: string): string {
  return stripLinks(s).replace(/^[*\-•]\s+/, "").replace(/\*{1,2}|__/g, "").trim();
}

/** "Non-EU applicants:" / "EU applicants (…):" / "All applicants (EU and non-EU applicants):" before a date. */
function groupFromLabel(label: string): string | null {
  const l = label.toLowerCase();
  if (/eu and non-eu|non-eu and eu|all applicants|all countries/.test(l)) return null;
  if (/non-eu|non eu|third[- ]countr/.test(l)) return "non-EU applicants";
  if (/\beu\b|\beea\b/.test(l)) return "EU applicants";
  return null;
}

const capitalise = (s: string) => `${s.charAt(0).toUpperCase()}${s.slice(1).toLowerCase()}`;

/**
 * Reads a DAAD programme page's "Application periods" block:
 *
 *   Application periods
 *        The following is valid for applicants from: non-EU countries
 *   For the winter semester:
 *   1 April - 15 May
 *
 * into one deadline per applicant group and semester. A range's deadline is
 * its end. `asOf` is when the page was fetched.
 */
export function parseDaadApplicationPeriods(markdown: string, asOf: Date): ApplicationPeriods {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === "Application periods");
  if (start < 0) return { found: false, deadlines: [], note: null };

  const deadlines: PeriodDeadline[] = [];
  let note: string | null = null;
  let members: string[] = [];
  let collecting = false;
  let intake: string | null = null;

  const take = (text: string) => {
    const clean = plainText(text);
    const dates = findDates(clean);
    if (dates.length === 0) return false;
    // In a range ("1 April - 15 May") the deadline is the end.
    const end = dates[dates.length - 1];
    // The structured layout states group and semester on their own lines;
    // free-form blocks ("Non-EU applicants: 1 May (for the upcoming winter
    // semester)") state them on the date's line.
    const group = members.length > 0 ? applicantGroup(members) : groupFromLabel(clean.slice(0, dates[0].index));
    const semester = intake ?? (clean.match(/(winter|summer) semester/i)?.[1] ? `${capitalise(clean.match(/(winter|summer) semester/i)![1])} semester` : null);
    const parts = [semester, group ? `(${group})` : null].filter(Boolean);
    deadlines.push({
      date: resolveDate(end, asOf).toISOString(),
      dateText: clean,
      intake: parts.length ? parts.join(" ") : null,
      sourceQuote: clean,
    });
    return true;
  };

  for (let j = start + 1; j < Math.min(lines.length, start + 60); j++) {
    const t = lines[j].trim();
    if (!t) continue;
    if (/^(More information on application periods|Submit application via)/i.test(t)) break;

    const group = t.match(/^The following is valid for applicants from:\s*(.*)$/i);
    if (group) {
      members = group[1] ? [group[1].trim()] : [];
      collecting = !group[1];
      intake = null;
      continue;
    }
    if (/^\*\s*\*\s*\*$/.test(t)) {
      collecting = false;
      continue;
    }
    if (collecting && /^\*\s+\S/.test(t)) {
      members.push(t.replace(/^\*\s+/, ""));
      continue;
    }
    collecting = false;

    const semester = t.match(/^For the (winter|summer) semester:?\s*(.*)$/i);
    if (semester) {
      intake = `${capitalise(semester[1])} semester`;
      if (semester[2]) take(semester[2]);
      continue;
    }
    if (/no deadline listed/i.test(t)) {
      note = "This programme has no deadline listed.";
      continue;
    }
    if (take(t)) continue;
    if (/check the|see the|website|application deadline/i.test(t)) {
      note = note ?? stripLinks(t);
      continue;
    }
    // Anything else is the next field of the page: the block has ended.
    break;
  }

  return { found: true, deadlines, note };
}

// ---------------------------------------------------------------------------
// Free-text deadlines (scholarship pages)
// ---------------------------------------------------------------------------

/** Words that make the date after them something other than a deadline. */
const NOT_A_DEADLINE = /\b(from|between|start\w*|begin\w*|commenc\w*|admission|funding|selection|interviews?|notification|results?|published|announce\w*|opens?|decision|arrival)\b/g;
/** Words that make the date after them a deadline. */
const IS_A_DEADLINE = /\b(deadlines?|until|by|closing|closes?|latest|later than|due|submi\w*|received|receipt|before)\b/g;
/** A range or window that is not an application period ("funding period: 1 October to 30 September"). */
const NOT_AN_APPLICATION_WINDOW = /funding|programme|program\b|course|stay|visit|study period|period of study/;
const RANGE_LINK = /^\s*(-|–|to|until|till)\s*$/;

function lastMatch(re: RegExp, s: string): number {
  let at = -1;
  for (const m of s.matchAll(re)) at = (m.index ?? 0) + m[0].length;
  return at;
}

/**
 * Dates out of a deadline sentence such as "The deadline for application is
 * 1 March for the summer semester and 15 September for the winter semester"
 * or "1 March and 1 September of each year".
 *
 * Each date is judged by the words between it and the date before it. Dates
 * that open an application window ("from 3 February", "between 4 November
 * and …", "Beginning of Application: 1 August"), start a programme or its
 * funding ("programme start 1 April", "for admission on 1 October") or belong
 * to a funding period are not deadlines. The end of an application window is.
 * Nomination deadlines (set for institutions, not applicants) are skipped.
 */
export function parseDeadlineText(text: string, asOf: Date): PeriodDeadline[] {
  const clean = stripLinks(text);
  const out: PeriodDeadline[] = [];
  const dates = findDates(clean);
  let rangeContext: string | null = null;
  dates.forEach((d, i) => {
    const prevEnd = i > 0 ? dates[i - 1].index + dates[i - 1].text.length : 0;
    const gap = clean.slice(prevEnd, d.index);
    const before = clean.slice(Math.max(0, d.index - 60), d.index).toLowerCase();
    const near = gap.slice(-45).toLowerCase();
    const after = clean.slice(d.index + d.text.length, d.index + d.text.length + 48).toLowerCase();

    const endsRange = i > 0 && rangeContext !== null && (RANGE_LINK.test(gap) || /^\s*and\s*$/.test(gap));
    const opensRange = /^\s*(-|–|to|until|till)\s/.test(after) || (/\bbetween\s*$/.test(near) && /^\s*and\s/.test(after));
    const context = rangeContext;
    // What a range is ("funding period: 1 October to …") is said right before
    // it; anything earlier describes the previous date.
    rangeContext = opensRange ? near.slice(-30) : null;

    if (/nominat/.test(before) && !/applica/.test(before.slice(-30))) return;
    if (opensRange) return; // the opening date of a window or period
    if (endsRange) {
      if (context && NOT_AN_APPLICATION_WINDOW.test(context) && !/appl|submi|regist/.test(context)) return;
    } else if (lastMatch(NOT_A_DEADLINE, near) > lastMatch(IS_A_DEADLINE, near)) {
      return;
    }

    // "15 September for the winter semester": the phrase after the date wins;
    // "for the winter semester: 15 September" falls back to the one before.
    const semester = after.slice(0, 40).match(/(winter|summer) semester/) ?? near.slice(-25).match(/(winter|summer) semester/);
    const group = after.slice(0, 25).match(/\((?:for )?(non-eu|eu)\b/);
    const parts = [
      semester ? `${semester[1].charAt(0).toUpperCase()}${semester[1].slice(1)} semester` : null,
      group ? `(${group[1] === "eu" ? "EU" : "non-EU"} applicants)` : null,
    ].filter(Boolean);
    out.push({
      date: resolveDate(d, asOf).toISOString(),
      dateText: d.year ? d.text : `${d.text}${/each year|annually|every year/i.test(clean) ? " (annually)" : ""}`,
      intake: parts.length ? parts.join(" ") : null,
      sourceQuote: clean.length > 300 ? `${clean.slice(0, 297)}…` : clean,
    });
  });
  return out;
}
