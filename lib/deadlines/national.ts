/**
 * Deadlines set nationally rather than by each course: one official calendar
 * applied to every course it governs, labelled as such and cited to the body
 * that sets it. Nothing here is estimated: a year's dates go in only once the
 * body has published them, checked against its own page.
 *
 * UK: UCAS key dates for 2027 entry, from
 * https://www.ucas.com/applying/applying-to-university/dates-and-deadlines-for-uni-applications
 * (read 25 Nov 2026):
 *   - 15 Oct 2026, 18:00 UK time: equal consideration date for the universities
 *     of Oxford and Cambridge, and most courses in medicine, dentistry and
 *     veterinary medicine/science ("it's unusual for them to consider late
 *     applications").
 *   - 13 Jan 2027, 18:00: equal consideration date for most undergraduate courses.
 *   - 30 Jun 2027, 18:00: applications received by then are sent to
 *     universities; after it they go into Clearing.
 *
 * France: Mon Master and Campus France's Études en France had not published
 * their 2027 calendars on 25 Nov 2026, so French programmes get no dates yet.
 */

export const UCAS_SOURCE_ID = "src-ucas-dates";
export const UCAS_DATES_URL = "https://www.ucas.com/applying/applying-to-university/dates-and-deadlines-for-uni-applications";

export interface NationalDeadline {
  /** The instant, in UTC. */
  date: Date;
  /** The date as UCAS words it, with its year, so it is never rolled forward to a guessed year. */
  dateText: string;
  /** Shown beside the date. */
  intake: string;
}

const ENTRY = "2027 entry";

// 18:00 UK time: GMT (UTC+0) in January, BST (UTC+1) in June and October.
const EARLY: NationalDeadline = {
  date: new Date(Date.UTC(2026, 9, 15, 17, 0)),
  dateText: "15 October 2026, 18:00 UK time",
  intake: `${ENTRY}: UCAS deadline for Oxford, Cambridge, medicine, dentistry and veterinary courses`,
};
const EQUAL_CONSIDERATION: NationalDeadline = {
  date: new Date(Date.UTC(2027, 0, 13, 18, 0)),
  dateText: "13 January 2027, 18:00 UK time",
  intake: `${ENTRY}: UCAS equal consideration date`,
};
const FINAL: NationalDeadline = {
  date: new Date(Date.UTC(2027, 5, 30, 17, 0)),
  dateText: "30 June 2027, 18:00 UK time",
  intake: `${ENTRY}: last UCAS date before Clearing`,
};

/**
 * Courses on UCAS's 15 October date: medicine, dentistry and veterinary
 * medicine/science themselves (graduate-entry and foundation-year routes
 * included), not neighbouring subjects such as veterinary nursing,
 * bioveterinary science or dental hygiene, which follow the January date.
 */
const EARLY_SUBJECT = new RegExp(
  [
    String.raw`^(foundation (to|year in) )?medicine\b`,
    String.raw`^medicine and surgery\b`,
    String.raw`\bdentistry\b`,
    String.raw`\bdental surge?r?y\b`,
    String.raw`(^|[^a-z])veterinary (medicine|science)\b`,
  ].join("|"),
  "i",
);

const EARLY_UNIVERSITIES = new Set(["University of Oxford", "University of Cambridge"]);

export interface UcasCourse {
  name: string;
  degreeLevel: string;
  studyMode: string | null;
  country: string | null;
  universityName: string;
}

/**
 * Whether UCAS's calendar governs a course: full-time undergraduate study in
 * the UK. Part-time courses are usually applied for directly to the
 * university, so they get no UCAS dates.
 */
export function isUcasCourse(c: UcasCourse): boolean {
  return (
    c.country === "GB" &&
    ["BACHELOR", "DIPLOMA", "CERTIFICATE"].includes(c.degreeLevel) &&
    Boolean(c.studyMode && /full-time/i.test(c.studyMode))
  );
}

export function isEarlyUcasCourse(c: Pick<UcasCourse, "name" | "universityName">): boolean {
  return EARLY_UNIVERSITIES.has(c.universityName) || EARLY_SUBJECT.test(c.name);
}

/** The UCAS dates for a course, or none when UCAS doesn't govern it. */
export function ucasDeadlinesFor(c: UcasCourse): NationalDeadline[] {
  if (!isUcasCourse(c)) return [];
  // Courses on the October date rarely consider later applications, so they get only that date.
  return isEarlyUcasCourse(c) ? [EARLY] : [EQUAL_CONSIDERATION, FINAL];
}
