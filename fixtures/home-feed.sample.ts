/**
 * Sample content for /dev/kit and tests only (docs/ui-remodel.md Appendix C).
 * Never import this from product code: it is illustrative, not real data.
 */
import type {
  ApplicationSummary,
  DeadlineItem,
  DestinationItem,
  FeaturedProgramme,
  InstitutionFace,
  OneAwayItem,
  ProgrammeCardData,
  ScholarshipCardData,
  UnlockData,
} from "@/lib/types/cards";

const face = (id: string, name: string, countryCode: string, city: string, acronym: string | null = null): InstitutionFace => ({
  id,
  name,
  acronym,
  countryCode,
  city,
  logoUrl: null,
  cover: null,
});

const UH = face("fx-uh", "University of Helsinki", "FI", "Helsinki");
const RWTH = face("fx-rwth", "RWTH Aachen University", "DE", "Aachen", "RWTH");
const TUD = face("fx-tud", "Delft University of Technology", "NL", "Delft");
const LUND = face("fx-lund", "Lund University", "SE", "Lund");
const UCD = face("fx-ucd", "University College Dublin", "IE", "Dublin");
const KUL = face("fx-kul", "KU Leuven", "BE", "Leuven");
const RUG = face("fx-rug", "University of Groningen", "NL", "Groningen");

export const sampleFeatured: FeaturedProgramme[] = [
  {
    id: "uh-cs",
    title: "MSc in Computer Science",
    degree: "MASTER",
    durationMonths: 24,
    institution: UH,
    tuition: { kind: "amount", amount: 18000, currency: "EUR", per: "year" },
    bestFunding: { label: "Full tuition scholarship", positive: true },
    nextDeadline: "2027-01-02T00:00:00.000Z",
    match: { score: 92, strength: "STRONG_MATCH", verified: true },
    reasons: [],
    longReasons: [
      { text: "Your BSc in Computer Science is a direct fit", met: true },
      { text: "Your 3.72 CGPA clears the entry bar", met: true },
      { text: "Needs IELTS 6.5, or a letter showing your degree was taught in English", met: false },
    ],
    saved: false,
    basis: "7 of 8 checks met",
    fundingLine: "University scholarship can cover full tuition",
    deadlineLine: "Applications close 2 Jan, in 53 days",
  },
  {
    id: "rwth-ds",
    title: "MSc in Data Science",
    degree: "MASTER",
    durationMonths: 24,
    institution: RWTH,
    tuition: { kind: "free" },
    bestFunding: { label: "No tuition fees", positive: true },
    nextDeadline: "2027-03-01T00:00:00.000Z",
    match: { score: 88, strength: "STRONG_MATCH", verified: true },
    reasons: [],
    longReasons: [
      { text: "No tuition fees at this public university", met: true },
      { text: "Your maths and statistics courses meet the prerequisites", met: true },
      { text: "Needs IELTS 6.5 before you apply", met: false },
    ],
    saved: true,
    basis: "6 of 7 checks met",
    fundingLine: "No tuition, small semester fee",
    deadlineLine: "Applications close 1 Mar, in 111 days",
  },
  {
    id: "tud-set",
    title: "MSc in Sustainable Energy Technology",
    degree: "MASTER",
    durationMonths: 24,
    institution: TUD,
    tuition: { kind: "amount", amount: 20500, currency: "EUR", per: "year" },
    bestFunding: { label: "Partial tuition scholarship", positive: true },
    nextDeadline: "2027-01-15T00:00:00.000Z",
    match: { score: 86, strength: "STRONG_MATCH", verified: true },
    reasons: [],
    longReasons: [
      { text: "Your CGPA meets the grade threshold", met: true },
      { text: "Holland Scholarship applies to this programme", met: true },
      { text: "Needs IELTS 6.5 with 6.0 in each part", met: false },
    ],
    saved: false,
    basis: "6 of 7 checks met",
    fundingLine: "Holland Scholarship: €5,000 in year one",
    deadlineLine: "Applications close 15 Jan, in 66 days",
  },
];

export const sampleUnlock: UnlockData = {
  title: "23 more programmes open up when you add an English test score",
  body: "Add your IELTS or TOEFL result. Some programmes accept a letter from your university confirming your degree was taught in English instead.",
  primary: { label: "Add test score", href: "/profile#language" },
  secondary: { label: "Upload a letter", href: "/profile#language" },
};

export const sampleApplications: ApplicationSummary[] = [
  { id: "fx-a1", title: "MSc in Computer Science", organisation: "University of Helsinki", institution: UH, stage: "IN_PROGRESS", done: 3, total: 5, deadline: "2027-01-02T00:00:00.000Z", next: "book an IELTS date" },
  { id: "fx-a2", title: "Scholarships for Global Professionals", organisation: "Swedish Institute", institution: face("fx-si", "Swedish Institute", "SE", "Stockholm"), stage: "PLANNING", done: 1, total: 6, deadline: null, next: "note your leadership roles" },
  { id: "fx-a3", title: "MSc in Data Science", organisation: "RWTH Aachen University", institution: RWTH, stage: "PLANNING", done: 1, total: 4, deadline: "2027-03-01T00:00:00.000Z", next: "check the uni-assist steps" },
];

const poster = (
  id: string,
  title: string,
  inst: InstitutionFace,
  score: number,
  funding: string,
  positive: boolean,
  months: number,
  deadline: string,
  reasons: string[],
): ProgrammeCardData => ({
  id,
  title,
  degree: "MASTER",
  durationMonths: months,
  institution: inst,
  tuition: { kind: "unknown" },
  bestFunding: { label: funding, positive },
  nextDeadline: `${deadline}T00:00:00.000Z`,
  match: { score, strength: score >= 85 ? "STRONG_MATCH" : "LIKELY_ELIGIBLE", verified: true },
  reasons: reasons.map((r) => (r.startsWith("!") ? { text: r.slice(1), met: false } : { text: r, met: true })),
  saved: false,
});

export const sampleStrongMatches: ProgrammeCardData[] = [
  poster("uh-cs", "MSc in Computer Science", UH, 92, "Full tuition scholarship", true, 24, "2027-01-02", ["BSc Computer Science fits", "CGPA clears the entry bar", "!Needs IELTS 6.5"]),
  poster("rwth-ds", "MSc in Data Science", RWTH, 88, "No tuition fees", true, 24, "2027-03-01", ["No tuition fees", "Maths prerequisites met", "!Needs IELTS 6.5"]),
  poster("lund-ml", "MSc in Machine Learning", LUND, 84, "Swedish Institute funding", true, 24, "2027-01-15", ["Field and degree fit", "Swedish Institute funding", "!Needs IELTS 6.5"]),
  poster("ucd-se", "MSc in Software Engineering", UCD, 81, "Partial scholarship", false, 12, "2027-03-31", ["Degree fits the course", "Open to all nationalities", "!Needs IELTS 6.5"]),
  poster("kul-ai", "MSc in Artificial Intelligence", KUL, 78, "Master Mind scholarship", true, 12, "2027-03-01", ["Field and degree fit", "Scholarship may apply", "!Needs IELTS 7.0"]),
  poster("rug-cs", "MSc in Computing Science", RUG, 76, "Holland Scholarship", true, 24, "2027-05-01", ["Degree fits the course", "Holland Scholarship applies", "!Needs IELTS 6.5"]),
];

const ticket = (id: string, title: string, organisation: string, cc: string, city: string, deadline: string): DeadlineItem => ({
  id,
  kind: "PROGRAM",
  targetId: id,
  title,
  organisation,
  institution: face(`fx-${id}`, organisation, cc, city),
  deadline: `${deadline}T00:00:00.000Z`,
  href: "#",
});

/** With "today" = 2026-11-10 these are 12, 19, 25, 31 and 53 days away. */
export const sampleClosingSoon: DeadlineItem[] = [
  ticket("cs1", "MSc in Environmental Science", "Ghent University", "BE", "Ghent", "2026-11-22"),
  ticket("cs2", "Erasmus Mundus Master in Big Data Management", "Erasmus Mundus consortium", "BE", "Brussels", "2026-11-29"),
  ticket("cs3", "MSc in Public Health", "Uppsala University", "SE", "Uppsala", "2026-12-05"),
  ticket("cs4", "MSc in Petroleum Geoscience", "University of Bergen", "NO", "Bergen", "2026-12-11"),
  ticket("cs5", "MSc in Computer Science", "University of Helsinki", "FI", "Helsinki", "2027-01-02"),
];

const fund = (
  id: string,
  title: string,
  provider: string,
  coverage: ScholarshipCardData["coverage"],
  amount: ScholarshipCardData["amount"],
  verified: boolean,
  deadlineText: string,
): ScholarshipCardData => ({
  id,
  title,
  provider: { name: provider, institution: null },
  coverage,
  amount,
  sourceVerified: verified,
  nextDeadline: null,
  deadlineText,
  match: null,
  saved: false,
});

export const sampleFunding: ScholarshipCardData[] = [
  fund("f1", "University of Helsinki Scholarship", "University of Helsinki", "FULL_TUITION", null, true, "Closes 2 Jan"),
  fund("f2", "Erasmus Mundus Joint Masters scholarship", "European Commission", "FULL_FUNDING", { value: 1400, currency: "EUR" }, true, "Varies by course"),
  fund("f3", "Scholarships for Global Professionals", "Swedish Institute", "FULL_FUNDING", { value: 12000, currency: "SEK" }, true, "Opens in December"),
  fund("f4", "Holland Scholarship", "Dutch Ministry of Education with universities", "VARIES", { value: 5000, currency: "EUR" }, true, "Closes 1 Feb"),
  fund("f5", "Master Mind Scholarships", "Flemish Government", "UNKNOWN", null, false, "Check with provider"),
];

export const sampleOneAway: OneAwayItem[] = [
  { id: "oa1", kind: "PROGRAM", title: "MSc in Embedded Systems", organisation: "Eindhoven University of Technology", institution: face("fx-tue", "Eindhoven University of Technology", "NL", "Eindhoven"), href: "#", gap: "Needs IELTS 6.5 with at least 6.0 in each part. You have not added a test yet.", from: 66, to: 87, action: { label: "Add test score", href: "/profile#language" } },
  { id: "oa2", kind: "PROGRAM", title: "MSc in Computer Science", organisation: "Saarland University", institution: face("fx-uds", "Saarland University", "DE", "Saarbrücken"), href: "#", gap: "Your living-cost budget is below what a German student visa asks you to show.", from: 61, to: 83, action: { label: "Find living-cost funding", href: "/scholarships?coverage=STIPEND" } },
  { id: "oa3", kind: "SCHOLARSHIP", title: "DAAD EPOS scholarship", organisation: "German Academic Exchange Service", institution: face("fx-daad", "German Academic Exchange Service", "DE", "Bonn", "DAAD"), href: "#", gap: "Needs 2 years of work experience. You have 14 months.", from: 58, to: 90, action: { label: "Update experience", href: "/profile#experience" } },
];

export const sampleDestinations: DestinationItem[] = [
  { countryCode: "DE", count: 38 },
  { countryCode: "NL", count: 21 },
  { countryCode: "SE", count: 17 },
  { countryCode: "FI", count: 14 },
  { countryCode: "BE", count: 12 },
  { countryCode: "IE", count: 9 },
];

/** Fixed "today" the samples are written against. */
export const SAMPLE_NOW = new Date("2026-11-10T09:00:00Z");
