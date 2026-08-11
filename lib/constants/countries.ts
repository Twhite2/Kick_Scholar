// Initial target countries (plan section 6) plus a few this MVP's real
// crawled/discovered data already touches (e.g. Belgium via the ARES
// scholarship). ISO 3166-1 alpha-2. Extend as new countries are added —
// this list is intentionally small and MVP-scoped, not exhaustive.
export const TARGET_COUNTRIES: Record<string, string> = {
  DE: "Germany",
  FI: "Finland",
  SE: "Sweden",
  FR: "France",
  NL: "Netherlands",
  DK: "Denmark",
  NO: "Norway",
  BE: "Belgium",
  IE: "Ireland",
  GB: "United Kingdom",
};

export function isKnownCountry(code: string): boolean {
  return code.toUpperCase() in TARGET_COUNTRIES;
}
