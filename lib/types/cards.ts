/**
 * Plain, serialisable props for every card in the student UI
 * (docs/ui-remodel.md §10.2). Loaders build these on the server; components
 * render them. Dates travel as ISO strings so they cross the server/client
 * boundary unchanged.
 */

import type { Strength } from "@/lib/ui/strength";
import type { Coverage } from "@/lib/ui/coverage";
import type { Reason } from "@/lib/ui/reasons";

export type { Strength, Coverage, Reason };

export interface CoverPhoto {
  url: string;
  width: number;
  height: number;
  color: string | null;
  credit: string | null;
  license: string | null;
  licenseUrl: string | null;
  sourceUrl: string | null;
}

/** An institution's recognisable face: logo, flag, city, cover. */
export interface InstitutionFace {
  id: string;
  name: string;
  acronym: string | null;
  countryCode: string | null; // ISO 3166-1 alpha-2
  city: string | null;
  logoUrl: string | null;
  cover: CoverPhoto | null;
}

export interface MatchInfo {
  score: number;
  strength: Strength;
  /** Whether the opportunity's own data is verified (drives the badge, not the score). */
  verified: boolean;
}

export type Tuition =
  | { kind: "free" }
  | { kind: "amount"; amount: number; currency: string; per: "year" | "semester" | "total" | null }
  | { kind: "varies" }
  | { kind: "unknown" };

export interface ProgrammeCardData {
  id: string;
  title: string;
  degree: string | null;
  durationMonths: number | null;
  /** "Full-time", "Part-time", "Full-time or part-time", as the source states it. */
  studyMode: string | null;
  institution: InstitutionFace;
  tuition: Tuition;
  /** "No tuition fees", "Full tuition scholarship", "€18,000 a year". */
  bestFunding: { label: string; positive: boolean } | null;
  /** Next future deadline, ISO date. */
  nextDeadline: string | null;
  match: MatchInfo | null;
  /** ≤ 3, short form, for hover previews. */
  reasons: Reason[];
  saved: boolean;
}

export type AmountPer = "month" | "year" | "once" | "total";

export interface ScholarshipCardData {
  id: string;
  title: string;
  provider: { name: string; institution: InstitutionFace | null };
  coverage: Coverage;
  /** `per` is how often it is paid, when the source says ("a monthly payment of 992 euros"). */
  amount: { value: number; currency: string; per: AmountPer | null } | null;
  sourceVerified: boolean;
  nextDeadline: string | null;
  deadlineText: string | null;
  match: MatchInfo | null;
  saved: boolean;
}

/** The Home billboard's slides: a programme poster plus its long-form lines. */
export interface FeaturedProgramme extends ProgrammeCardData {
  /** Long-form reasons for the billboard (≤ 3). */
  longReasons: Reason[];
  basis: string | null;
  fundingLine: string | null;
  deadlineLine: string;
}

export type ApplicationStage =
  | "SAVED"
  | "PLANNING"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "ACCEPTED"
  | "REJECTED"
  | "WITHDRAWN";

export interface ApplicationSummary {
  id: string;
  title: string;
  organisation: string;
  institution: InstitutionFace | null;
  stage: ApplicationStage;
  done: number;
  total: number;
  /** ISO date of the next deadline, if one is published. */
  deadline: string | null;
  /** First unchecked document, if there is a checklist. */
  next: string | null;
}

export interface DeadlineItem {
  id: string;
  kind: "PROGRAM" | "SCHOLARSHIP";
  targetId: string;
  title: string;
  organisation: string;
  institution: InstitutionFace | null;
  /** ISO date. */
  deadline: string;
  href: string;
}

export interface OneAwayItem {
  id: string;
  kind: "PROGRAM" | "SCHOLARSHIP";
  title: string;
  organisation: string;
  institution: InstitutionFace | null;
  href: string;
  /** "{requirement}. {your status}." */
  gap: string;
  from: number;
  /** Null when no projection is available; the card then drops the "rises" line. */
  to: number | null;
  action: { label: string; href: string } | null;
}

export interface DestinationItem {
  countryCode: string;
  count: number;
}

export interface UnlockData {
  title: string;
  body: string;
  primary: { label: string; href: string };
  secondary?: { label: string; href: string };
}
