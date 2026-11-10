import { hash32 } from "./monogram";

/**
 * Country names, tints and illustrated scenes (docs/ui-remodel.md §6.2, §6.3,
 * Appendix B). Cards always print a country *name*, never the raw ISO code.
 */

let displayNames: Intl.DisplayNames | null = null;

function names(): Intl.DisplayNames | null {
  if (displayNames) return displayNames;
  try {
    displayNames = new Intl.DisplayNames(["en-GB"], { type: "region", fallback: "code" });
  } catch {
    displayNames = null;
  }
  return displayNames;
}

const ISO2 = /^[A-Z]{2}$/;

/** "DE" -> "Germany". Falls back to whatever was passed when it isn't a code. */
export function countryName(code: string | null | undefined): string {
  if (!code) return "";
  const upper = code.trim().toUpperCase();
  if (!ISO2.test(upper)) return code;
  try {
    return names()?.of(upper) ?? upper;
  } catch {
    return upper;
  }
}

/** True when `code` is a two-letter region Intl can name (so a flag exists). */
export function isCountryCode(code: string | null | undefined): code is string {
  if (!code) return false;
  const upper = code.trim().toUpperCase();
  if (!ISO2.test(upper)) return false;
  return countryName(upper) !== upper;
}

const TINTS: Record<string, string> = {
  FI: "#10304F",
  SE: "#2C5D7A",
  NO: "#2C5D7A",
  DK: "#2C5D7A",
  IE: "#2C5D7A",
  DE: "#2E5B82",
  NL: "#A54A33",
  BE: "#3B4763",
  FR: "#3B4763",
  GB: "#3B4763",
};
const DEFAULT_TINT = "#3A4A5E";

/** Flat colour for data saver and missing photos. White text passes on all. */
export function countryTint(code: string | null | undefined): string {
  return (code && TINTS[code.toUpperCase()]) || DEFAULT_TINT;
}

export type SceneName = "nordic" | "canal" | "gothic" | "modern" | "harbour";

const SCENES: Record<string, SceneName[]> = {
  FI: ["nordic"],
  SE: ["harbour", "nordic"],
  NO: ["harbour"],
  DK: ["harbour", "canal"],
  DE: ["modern", "gothic"],
  NL: ["canal"],
  BE: ["gothic", "canal"],
  FR: ["gothic"],
  IE: ["harbour", "gothic"],
  GB: ["gothic", "modern"],
};
const DEFAULT_SCENES: SceneName[] = ["modern", "gothic"];

export function scenesFor(code: string | null | undefined): SceneName[] {
  return (code && SCENES[code.toUpperCase()]) || DEFAULT_SCENES;
}

/** Varied per institution where the country allows more than one scene. */
export function sceneFor(code: string | null | undefined, institutionId: string): SceneName {
  const options = scenesFor(code);
  return options[hash32(institutionId) % options.length];
}

/** Destination tiles always use the first scene listed for the country. */
export function destinationScene(code: string | null | undefined): SceneName {
  return scenesFor(code)[0];
}

export function sceneUrl(scene: SceneName): string {
  return `/scenes/${scene}.svg`;
}
