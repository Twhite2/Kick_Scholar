/**
 * Monograms for institutions without a logo (docs/ui-remodel.md §6.1).
 *
 * The letters come from the acronym when one is stored, otherwise from the
 * first letter of up to three significant words, skipping connectives in the
 * languages our catalogue actually contains ("Université de …", "Universität
 * für …", "Universiteit van …").
 */

const STOP = new Set([
  "of", "the", "and", "for", "at", "in", "on", "de", "des", "du", "la", "le", "les",
  "di", "del", "della", "der", "den", "van", "von", "für", "fur", "und", "et", "y", "i", "&",
]);

/** FNV-1a, 32-bit. Stable across runtimes, so a seed always gives one colour. */
export function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function monogramText(name: string, acronym?: string | null): string {
  const a = acronym?.replace(/\s+/g, "");
  if (a && a.length >= 2 && a.length <= 5) return a.toUpperCase();
  const words = name
    .split(/[\s\-–—/,]+/)
    .map((w) => w.replace(/^[^\p{L}\p{N}]+/u, ""))
    .filter(Boolean)
    .filter((w) => !STOP.has(w.toLowerCase()));
  const letters = words
    .slice(0, 3)
    .map((w) => Array.from(w)[0])
    .join("");
  return (letters || Array.from(name.trim()).slice(0, 2).join("")).toUpperCase();
}

/** Every colour passes 4.99:1 or better on white. */
export const MONOGRAM_PALETTE = [
  "#1D5FA8",
  "#B45309",
  "#0F766E",
  "#7C3AED",
  "#BE123C",
  "#4D7C0F",
  "#9A3412",
  "#0369A1",
  "#A21CAF",
  "#334155",
] as const;

export function monogramColor(seed: string): string {
  return MONOGRAM_PALETTE[hash32(seed) % MONOGRAM_PALETTE.length];
}

/** Font size relative to the tile, by letter count. */
export function monogramScale(text: string): number {
  const n = Array.from(text).length;
  if (n <= 2) return 0.34;
  if (n === 3) return 0.3;
  return 0.25;
}
