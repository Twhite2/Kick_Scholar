import type { FactorScore } from "@/lib/matching/types";
import { projectScore } from "@/lib/matching/project";
import { actionOf, blockersOf, unlockCopy, type ActionKind, type Blocker, type BlockerKind } from "@/lib/ui/blockers";
import { daysUntil } from "@/lib/ui/format";
import { isTopStrength, type Strength } from "@/lib/ui/strength";

/**
 * Home feed selection rules (docs/ui-remodel.md §9.1). Pure functions over
 * already-loaded rows, so the caps, ordering and exclusions are unit-tested
 * without a database.
 */

export const LIMITS = {
  featured: 3,
  strong: 20,
  closingSoon: 12,
  closingWindowDays: 45,
  funding: 20,
  oneAway: 10,
  oneAwayCandidates: 30,
  destinations: 10,
  applications: 3,
} as const;

export interface MatchLite {
  id: string;
  kind: "PROGRAM" | "SCHOLARSHIP";
  targetId: string;
  score: number;
  strength: Strength;
  factorScores: FactorScore[];
  /** When the programme or scholarship first entered the catalogue. */
  createdAt: Date | null;
  /** Institution country for programmes. */
  countryCode: string | null;
}

// ---------------------------------------------------------------------------
// Billboard
// ---------------------------------------------------------------------------

export interface FeaturedCandidate {
  match: MatchLite;
  hasOfficialFunding: boolean;
  nextDeadline: Date | null;
}

/**
 * Strong match or Likely eligible programmes with a future (or unknown)
 * deadline, by score, then officially linked funding, then soonest deadline.
 * Falls back to the best matches that aren't missing a requirement.
 */
export function selectFeatured(candidates: FeaturedCandidate[], now: Date): FeaturedCandidate[] {
  const open = (c: FeaturedCandidate) => c.nextDeadline === null || daysUntil(c.nextDeadline, now) >= 0;
  const order = (a: FeaturedCandidate, b: FeaturedCandidate) =>
    b.match.score - a.match.score ||
    Number(b.hasOfficialFunding) - Number(a.hasOfficialFunding) ||
    (a.nextDeadline?.getTime() ?? Infinity) - (b.nextDeadline?.getTime() ?? Infinity);

  const top = candidates.filter((c) => c.match.kind === "PROGRAM" && isTopStrength(c.match.strength) && open(c));
  if (top.length > 0) return [...top].sort(order).slice(0, LIMITS.featured);
  return candidates
    .filter((c) => c.match.kind === "PROGRAM" && c.match.strength !== "MISSING_REQUIREMENT")
    .sort(order)
    .slice(0, LIMITS.featured);
}

// ---------------------------------------------------------------------------
// Rails
// ---------------------------------------------------------------------------

const byScore = (a: MatchLite, b: MatchLite) => b.score - a.score;

export function selectStrongMatches(matches: MatchLite[]): { items: MatchLite[]; total: number } {
  const all = matches.filter((m) => m.kind === "PROGRAM" && isTopStrength(m.strength)).sort(byScore);
  return { items: all.slice(0, LIMITS.strong), total: all.length };
}

/** Strong programme matches that first appeared after the previous Home visit. */
export function countNewSince(strong: MatchLite[], previousVisit: Date | null): number {
  if (!previousVisit) return 0;
  return strong.filter((m) => m.createdAt && m.createdAt > previousVisit).length;
}

const FUNDING_STRENGTHS: Strength[] = ["STRONG_MATCH", "LIKELY_ELIGIBLE", "NEEDS_VERIFICATION"];

export function selectFunding(matches: MatchLite[]): { items: MatchLite[]; total: number } {
  const all = matches.filter((m) => m.kind === "SCHOLARSHIP" && FUNDING_STRENGTHS.includes(m.strength)).sort(byScore);
  return { items: all.slice(0, LIMITS.funding), total: all.length };
}

export interface DeadlineCandidate {
  match: MatchLite;
  deadline: Date;
}

/** Future deadlines within 45 days, soonest first, never for a missing requirement. */
export function selectClosingSoon(candidates: DeadlineCandidate[], now: Date): DeadlineCandidate[] {
  const best = new Map<string, DeadlineCandidate>();
  for (const c of candidates) {
    if (c.match.strength === "MISSING_REQUIREMENT") continue;
    const days = daysUntil(c.deadline, now);
    if (days < 0 || days > LIMITS.closingWindowDays) continue;
    const existing = best.get(c.match.id);
    if (!existing || c.deadline < existing.deadline) best.set(c.match.id, c);
  }
  return [...best.values()]
    .sort((a, b) => a.deadline.getTime() - b.deadline.getTime() || b.match.score - a.match.score)
    .slice(0, LIMITS.closingSoon);
}

export function selectDestinations(matches: MatchLite[]): Array<{ countryCode: string; count: number }> {
  const counts = new Map<string, number>();
  for (const m of matches) {
    if (m.kind !== "PROGRAM" || m.strength === "MISSING_REQUIREMENT" || !m.countryCode) continue;
    counts.set(m.countryCode, (counts.get(m.countryCode) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([countryCode, count]) => ({ countryCode, count }))
    .sort((a, b) => b.count - a.count || a.countryCode.localeCompare(b.countryCode))
    .slice(0, LIMITS.destinations);
}

// ---------------------------------------------------------------------------
// One requirement away
// ---------------------------------------------------------------------------

export interface OneAwayCandidate {
  match: MatchLite;
  blocker: Blocker;
  /** Null only if a projection could not be made. */
  projected: number | null;
}

const UNFIXABLE: BlockerKind[] = ["NOT_ELIGIBLE", "DEGREE_NOT_ELIGIBLE"];

/**
 * Potential or missing-requirement matches with exactly one blocker that
 * reach 70 or more once that blocker is met, biggest gain first. Nationality
 * and degree-level exclusions are never offered: nothing can be done.
 */
export function selectOneAway(matches: MatchLite[]): OneAwayCandidate[] {
  const candidates = matches
    .filter((m) => m.strength === "POTENTIAL_MATCH" || m.strength === "MISSING_REQUIREMENT")
    .map((m) => ({ match: m, blockers: blockersOf(m.factorScores) }))
    .filter(({ blockers }) => blockers.length === 1 && !UNFIXABLE.includes(blockers[0].kind))
    .sort((a, b) => b.match.score - a.match.score)
    .slice(0, LIMITS.oneAwayCandidates);

  return candidates
    .map(({ match, blockers }) => ({
      match,
      blocker: blockers[0],
      projected: projectScore(match.factorScores, blockers[0].factor),
    }))
    .filter((c) => c.projected !== null && c.projected >= 70 && c.projected > c.match.score)
    .sort((a, b) => (b.projected! - b.match.score) - (a.projected! - a.match.score) || b.projected! - a.projected!)
    .slice(0, LIMITS.oneAway);
}

// ---------------------------------------------------------------------------
// Unlock card
// ---------------------------------------------------------------------------

export type UnlockKind = ActionKind | BlockerKind | "PREFERENCES_MISSING";

/** Tie-break when two gaps affect the same number of opportunities. */
const UNLOCK_PRIORITY: UnlockKind[] = [
  "ENGLISH_TEST_MISSING",
  "CGPA_MISSING",
  "ENGLISH_SCORE_LOW",
  "WORK_EXPERIENCE_MISSING",
  "WORK_EXPERIENCE_SHORT",
  "BUDGET_MISSING",
  "BUDGET_OVER",
  "GPA_SCALE_MISSING",
  "EDUCATION_LEVEL_MISSING",
  "LANGUAGE_TEST_MISSING",
];

/**
 * The student's biggest fixable gap, by how many opportunities it touches
 * (the same ordering as the eligibility report's "What you can do").
 */
export function selectUnlock(
  matches: MatchLite[],
  profile: { preferredCountries: string[]; desiredFields: string[]; completeness: number },
): { kind: UnlockKind; counts: { programmes: number; scholarships: number } } | null {
  const counts = new Map<UnlockKind, { programmes: number; scholarships: number }>();
  const bump = (kind: UnlockKind, m: MatchLite, seen: Set<UnlockKind>) => {
    if (seen.has(kind)) return;
    seen.add(kind);
    const c = counts.get(kind) ?? { programmes: 0, scholarships: 0 };
    if (m.kind === "PROGRAM") c.programmes += 1;
    else c.scholarships += 1;
    counts.set(kind, c);
  };

  for (const m of matches) {
    const seen = new Set<UnlockKind>();
    for (const f of m.factorScores) {
      if (f.hardFail) continue;
      const action = actionOf(f);
      if (action) bump(action, m, seen);
    }
    for (const b of blockersOf(m.factorScores)) bump(b.kind, m, seen);
  }

  const ranked = [...counts.entries()]
    .filter(([kind, c]) => unlockCopy(kind, c) !== null)
    .sort(([ka, a], [kb, b]) => {
      const relevant = (k: UnlockKind, c: { programmes: number; scholarships: number }) =>
        k === "WORK_EXPERIENCE_SHORT" ? c.scholarships : k.startsWith("ENGLISH") || k.startsWith("BUDGET") ? c.programmes : c.programmes + c.scholarships;
      return relevant(kb, b) - relevant(ka, a) || UNLOCK_PRIORITY.indexOf(ka) - UNLOCK_PRIORITY.indexOf(kb);
    });
  if (ranked.length > 0) return { kind: ranked[0][0], counts: ranked[0][1] };

  if (profile.preferredCountries.length === 0) {
    return { kind: "PREFERENCES_MISSING", counts: { programmes: 0, scholarships: 0 } };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Pick up where you left off
// ---------------------------------------------------------------------------

export interface ApplicationLite {
  id: string;
  status: string;
  updatedAt: Date;
  nextDeadline: Date | null;
}

/** Open applications, nearest future deadline first (unknown last), then most recent. */
export function selectApplications<T extends ApplicationLite>(apps: T[], now: Date): T[] {
  const closed = new Set(["ACCEPTED", "REJECTED", "WITHDRAWN"]);
  const future = (d: Date | null) => (d && daysUntil(d, now) >= 0 ? d.getTime() : Infinity);
  return apps
    .filter((a) => !closed.has(a.status))
    .sort((a, b) => future(a.nextDeadline) - future(b.nextDeadline) || b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, LIMITS.applications);
}
