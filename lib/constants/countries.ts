// The study destinations KickScholar covers: every country with institutions
// in the catalogue, from the original European list to the destinations of
// the scholarships now carried (Japan for MEXT, Türkiye for Türkiye
// Burslari, China, Australia, and the Erasmus Mundus partner countries).
// Students pick their preferred countries from this list, the catalogues
// filter by it, and the ROR import defaults to it. ISO 3166-1 alpha-2.
// Extend it when a new country's institutions are imported.
export const TARGET_COUNTRIES: Record<string, string> = {
  AT: "Austria",
  AU: "Australia",
  BE: "Belgium",
  CN: "China",
  CZ: "Czechia",
  DE: "Germany",
  DK: "Denmark",
  ES: "Spain",
  FI: "Finland",
  FR: "France",
  GB: "United Kingdom",
  IE: "Ireland",
  IT: "Italy",
  JP: "Japan",
  NL: "Netherlands",
  NO: "Norway",
  PL: "Poland",
  PT: "Portugal",
  SE: "Sweden",
  TR: "Türkiye",
};

export function isKnownCountry(code: string): boolean {
  return code.toUpperCase() in TARGET_COUNTRIES;
}
