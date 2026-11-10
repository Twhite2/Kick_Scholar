/**
 * Resolves the country names real sources write into ISO 3166-1 alpha-2.
 *
 * Built from the values actually present in the crawled corpus rather than
 * from a general country list, so it covers what the data contains: city
 * qualifiers ("Paris, France", "Munich, Germany"), informal short forms
 * ("UK", "USA", "UAE"), constituent countries ("Scotland", "England"), and the
 * handful of misspellings the aggregator publishes ("Ausralia", "Morocoo",
 * "Netherland").
 *
 * Regions and non-places ("Worldwide", "Europe", "Remote", "Home country")
 * resolve to nothing on purpose. They are meaningful statements, but not ones
 * a country column can hold, and guessing a country for them would invent a
 * restriction the source never stated.
 */

const BY_NAME: Record<string, string> = {
  // Most frequent in the corpus first; grouped only for readability.
  "united states": "US", usa: "US", "u.s.": "US", "u.s.a.": "US", america: "US",
  "united states of america": "US", "united state": "US", us: "US",
  "united kingdom": "GB", uk: "GB", "great britain": "GB", britain: "GB",
  england: "GB", scotland: "GB", wales: "GB", "northern ireland": "GB",
  germany: "DE", deutschland: "DE",
  canada: "CA",
  china: "CN", "people's republic of china": "CN",
  japan: "JP",
  australia: "AU", ausralia: "AU",
  italy: "IT",
  switzerland: "CH",
  "south korea": "KR", korea: "KR", "republic of korea": "KR",
  "saudi arabia": "SA",
  netherlands: "NL", netherland: "NL", "the netherlands": "NL", holland: "NL",
  turkey: "TR", türkiye: "TR", turkiye: "TR",
  thailand: "TH",
  taiwan: "TW",
  austria: "AT",
  sweden: "SE",
  singapore: "SG",
  france: "FR",
  portugal: "PT",
  pakistan: "PK",
  malaysia: "MY",
  ireland: "IE",
  spain: "ES",
  hungary: "HU",
  "united arab emirates": "AE", uae: "AE", dubai: "AE", "abu dhabi": "AE",
  "south africa": "ZA",
  poland: "PL",
  qatar: "QA",
  "new zealand": "NZ",
  belgium: "BE",
  russia: "RU", "russian federation": "RU",
  indonesia: "ID",
  finland: "FI",
  norway: "NO",
  denmark: "DK",
  romania: "RO",
  morocco: "MA", morocoo: "MA",
  "hong kong": "HK",
  brazil: "BR",
  nigeria: "NG",
  india: "IN",
  egypt: "EG",
  malta: "MT",
  kuwait: "KW",
  "czech republic": "CZ", czechia: "CZ",
  azerbaijan: "AZ",
  vietnam: "VN", "viet nam": "VN",
  slovakia: "SK",
  philippines: "PH",
  mexico: "MX",
  iceland: "IS",
  croatia: "HR",
  colombia: "CO",
  belarus: "BY",
  greece: "GR",
  uzbekistan: "UZ",
  tanzania: "TZ",
  slovenia: "SI",
  serbia: "RS",
  peru: "PE",
  mongolia: "MN",
  moldova: "MD",
  mauritius: "MU",
  luxembourg: "LU",
  lithuania: "LT",
  lebanon: "LB",
  latvia: "LV",
  kenya: "KE",
  kazakhstan: "KZ",
  jordan: "JO",
  israel: "IL",
  georgia: "GE",
  ethiopia: "ET",
  estonia: "EE",
  "dominican republic": "DO",
  chile: "CL",
  cyprus: "CY",
  bulgaria: "BG",
  brunei: "BN",
  cambodia: "KH",
  armenia: "AM",
  albania: "AL",
  montenegro: "ME",
  argentina: "AR",
  ghana: "GH",
  ukraine: "UA",
  nepal: "NP",
  bangladesh: "BD",
  "sri lanka": "LK",
  "north macedonia": "MK", macedonia: "MK",
  "bosnia and herzegovina": "BA",
  palestine: "PS",
  bahrain: "BH",
  oman: "OM",
  tunisia: "TN",
  algeria: "DZ",
  senegal: "SN",
  rwanda: "RW",
  uganda: "UG",
  zambia: "ZM",
  zimbabwe: "ZW",
  botswana: "BW",
  namibia: "NA",
  liechtenstein: "LI",
  monaco: "MC",
  "french guiana": "GF",
  guatemala: "GT", belize: "BZ", "el salvador": "SV", honduras: "HN",
  nicaragua: "NI", panama: "PA", "costa rica": "CR",
};

/**
 * Cities and regions that appear as the whole value. Listed so a "Paris,
 * London" style value resolves to nothing rather than accidentally matching a
 * country-shaped fragment.
 */
const NOT_A_COUNTRY = new Set([
  "worldwide", "global", "europe", "european countries", "european union",
  "asia", "africa", "americas", "the americas", "middle east", "south asia",
  "apac region", "arab countries", "adb members", "different countries",
  "various countries", "multiple countries", "remote", "home country",
  "online", "140 countries", "europe and asia", "any country", "all countries",
]);

const ISO2 = /^[A-Z]{2}$/;

/** Resolves one name. Returns null when it is not a country we can name. */
export function resolveCountryName(raw: string): string | null {
  const token = raw.trim().replace(/\.$/, "");
  if (!token) return null;

  // Strip a markdown link wrapper: "[Greece](https://…/tag/greece/)".
  const unlinked = token.replace(/^\[([^\]]+)\]\([^)]*\)$/, "$1").trim();
  const lower = unlinked.toLowerCase();

  if (NOT_A_COUNTRY.has(lower)) return null;
  if (BY_NAME[lower]) return BY_NAME[lower];
  if (ISO2.test(unlinked)) return unlinked;
  return null;
}

/**
 * Resolves a free-text place value that may name several countries, or
 * qualify one with a city ("Munich, Germany").
 *
 * Returns every distinct country it can identify, in first-seen order.
 * Unresolvable fragments are simply not returned — the caller decides whether
 * a partial resolution is usable, which is why nothing is invented here.
 */
export function resolveCountryList(raw: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  // Split on the separators these values actually use, including "and" and
  // "or" written out, so "USA, Canada, and Mexico" yields three.
  for (const part of raw.split(/,|;|\/|&|\band\b|\bor\b|\|/i)) {
    const code = resolveCountryName(part);
    if (code && !seen.has(code)) {
      seen.add(code);
      out.push(code);
    }
  }
  return out;
}

/**
 * Display names for the ISO codes stored on records, derived from the same
 * table used to resolve them. Built by inverting BY_NAME so the two can never
 * disagree: every code the resolver can produce has a label here.
 *
 * Where several names map to one code ("united kingdom", "uk", "britain"),
 * the longest is kept, which is reliably the formal one.
 */
export const COUNTRY_LABELS: Record<string, string> = (() => {
  const byCode: Record<string, string> = {};
  for (const [name, code] of Object.entries(BY_NAME)) {
    const title = name.replace(/\b\w/g, (c) => c.toUpperCase());
    if (!byCode[code] || title.length > byCode[code].length) byCode[code] = title;
  }
  return byCode;
})();
