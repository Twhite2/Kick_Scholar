/**
 * Match strength for the UI (docs/ui-remodel.md §6.4).
 *
 * The thresholds live in lib/matching/classify.ts and are re-exported, never
 * copied: the UI reads the strength the engine stored. This file only maps a
 * strength onto words and colours.
 */

export { classify } from "@/lib/matching/classify";

export type Strength =
  | "STRONG_MATCH"
  | "LIKELY_ELIGIBLE"
  | "POTENTIAL_MATCH"
  | "NEEDS_VERIFICATION"
  | "MISSING_REQUIREMENT";

export const STRENGTH_ORDER: Strength[] = [
  "STRONG_MATCH",
  "LIKELY_ELIGIBLE",
  "POTENTIAL_MATCH",
  "NEEDS_VERIFICATION",
  "MISSING_REQUIREMENT",
];

/** Exactly these words, everywhere (§14.2). */
export const STRENGTH_LABEL: Record<Strength, string> = {
  STRONG_MATCH: "Strong match",
  LIKELY_ELIGIBLE: "Likely eligible",
  POTENTIAL_MATCH: "Potential match",
  NEEDS_VERIFICATION: "Needs verification",
  MISSING_REQUIREMENT: "Missing requirement",
};

export type StrengthTone = "green" | "blue" | "grey" | "red";

export const STRENGTH_TONE: Record<Strength, StrengthTone> = {
  STRONG_MATCH: "green",
  LIKELY_ELIGIBLE: "green",
  POTENTIAL_MATCH: "blue",
  NEEDS_VERIFICATION: "grey",
  MISSING_REQUIREMENT: "red",
};

/** Dial arc colour on light surfaces. */
export const STRENGTH_ACCENT: Record<Strength, string> = {
  STRONG_MATCH: "var(--kick-green)",
  LIKELY_ELIGIBLE: "var(--kick-green)",
  POTENTIAL_MATCH: "var(--kick-blue)",
  NEEDS_VERIFICATION: "var(--unverified)",
  MISSING_REQUIREMENT: "var(--kick-red)",
};

/** Dial arc colour on night surfaces, where the light accents lose contrast. */
export const STRENGTH_ACCENT_NIGHT: Record<Strength, string> = {
  STRONG_MATCH: "var(--on-night-success)",
  LIKELY_ELIGIBLE: "var(--on-night-success)",
  POTENTIAL_MATCH: "var(--on-night-link)",
  NEEDS_VERIFICATION: "var(--on-night-muted)",
  MISSING_REQUIREMENT: "var(--on-night-danger)",
};

/** Badge classes: tint background with a text colour that passes on it. */
export const STRENGTH_BADGE_CLASS: Record<Strength, string> = {
  STRONG_MATCH: "bg-green-tint text-green-text",
  LIKELY_ELIGIBLE: "bg-green-tint text-green-text",
  POTENTIAL_MATCH: "bg-blue-tint text-kick-blue",
  NEEDS_VERIFICATION: "bg-grey-tint text-slate",
  MISSING_REQUIREMENT: "bg-red-tint text-red-text",
};

export function isStrength(value: unknown): value is Strength {
  return typeof value === "string" && (STRENGTH_ORDER as string[]).includes(value);
}

/** Strong match or Likely eligible: the bands the product calls "you qualify". */
export function isTopStrength(strength: Strength): boolean {
  return strength === "STRONG_MATCH" || strength === "LIKELY_ELIGIBLE";
}

/** Anything except an outright missing requirement. */
export function isQualifying(strength: Strength): boolean {
  return strength !== "MISSING_REQUIREMENT";
}

/** "92 percent match, Strong match" — the dial's accessible name. */
export function dialLabel(score: number, strength: Strength): string {
  return `${Math.round(score)} percent match, ${STRENGTH_LABEL[strength]}`;
}
