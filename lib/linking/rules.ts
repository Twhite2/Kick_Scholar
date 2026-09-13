import type { EligibilityCriterionType } from "@/lib/generated/prisma/enums";

/**
 * Turns a scholarship's raw `ScholarshipEligibility` rows into a rule set the
 * linker can evaluate against the catalogue.
 *
 * This exists because what the extractor stores and what SQL can filter on are
 * not the same thing. The LLM was asked for ISO 3166-1 alpha-2 codes and
 * mostly complied, but the real table also contains "Germany", "EU",
 * "Latin America" and "ANY" — values that are perfectly good evidence and
 * completely unusable as a `WHERE country IN (...)` clause. Normalising here,
 * once, keeps that mess out of the query builder and makes every dropped token
 * visible rather than silently ignored.
 */

const ISO2 = /^[A-Z]{2}$/;

/** Names observed in the extracted data, plus the obvious near-misses. */
const COUNTRY_NAMES: Record<string, string> = {
  germany: "DE", deutschland: "DE",
  finland: "FI", sweden: "SE", france: "FR", netherlands: "NL",
  denmark: "DK", norway: "NO", belgium: "BE", ireland: "IE",
  "united kingdom": "GB", uk: "GB", "great britain": "GB",
  switzerland: "CH", austria: "AT", italy: "IT", spain: "ES",
  poland: "PL", portugal: "PT", greece: "GR", "czech republic": "CZ",
  turkey: "TR", türkiye: "TR", jordan: "JO", palestine: "PS",
};

/**
 * "EU" appears as a country token often enough to matter. Expanding it is a
 * definitional lookup, not a claim about the scholarship — the page said EU,
 * and these are the EU's members. Recorded in `inferenceBasis` all the same so
 * the expansion is never invisible.
 */
const EU_27 = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR",
  "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK",
  "SI", "ES", "SE",
];

const DEGREE_LEVELS = new Set([
  "HIGH_SCHOOL", "BACHELOR", "MASTER", "PHD", "DIPLOMA", "CERTIFICATE", "OTHER",
]);
const FIELD_CATEGORIES = new Set([
  "STEM", "BUSINESS", "HUMANITIES", "SOCIAL_SCIENCES", "ARTS", "HEALTH",
  "LAW", "EDUCATION", "OTHER",
]);

export interface EligibilityRow {
  criterionType: EligibilityCriterionType;
  valueList: string[];
}

export interface ScholarshipRules {
  /** ISO 3166-1 alpha-2, deduped. Empty means "no usable country bound". */
  countries: string[];
  degreeLevels: string[];
  fieldCategories: string[];
  /**
   * Recorded, never filtered on. `University.type` is null for 991 of the 993
   * rows in the catalogue — ROR does not publish public/private and we
   * deliberately did not guess it — so treating "state-recognised" as a
   * predicate would match nothing and silently delete every link for the 124
   * scholarships that state one. It belongs in the audit trail, not the WHERE.
   */
  institutionTypes: string[];
  /** Tokens that carried meaning but could not be turned into a filter. */
  unresolved: string[];
}

function normaliseCountry(raw: string, unresolved: string[]): string[] {
  const token = raw.trim();
  if (!token) return [];
  const upper = token.toUpperCase();
  if (upper === "EU") return EU_27;
  if (ISO2.test(upper)) return [upper];
  const byName = COUNTRY_NAMES[token.toLowerCase()];
  if (byName) return [byName];
  // Continents and regions ("Latin America", "Asia", "Africa") land here.
  // They are real statements about the scholarship, just not ones this
  // catalogue can resolve, so they are surfaced rather than discarded.
  unresolved.push(token);
  return [];
}

export function deriveRules(rows: readonly EligibilityRow[]): ScholarshipRules {
  const countries = new Set<string>();
  const degreeLevels = new Set<string>();
  const fieldCategories = new Set<string>();
  const institutionTypes = new Set<string>();
  const unresolved: string[] = [];

  for (const row of rows) {
    for (const value of row.valueList) {
      switch (row.criterionType) {
        case "COUNTRY_OF_STUDY":
          for (const c of normaliseCountry(value, unresolved)) countries.add(c);
          break;
        case "DEGREE_LEVEL": {
          const v = value.trim().toUpperCase();
          if (DEGREE_LEVELS.has(v)) degreeLevels.add(v);
          else unresolved.push(value);
          break;
        }
        case "FIELD_OF_STUDY": {
          const v = value.trim().toUpperCase().replace(/[ -]/g, "_");
          // "ANY" / "ALL" are the model saying "no restriction". Treating them
          // as a category would wrongly narrow the scholarship to nothing.
          if (v === "ANY" || v === "ALL") break;
          if (FIELD_CATEGORIES.has(v)) fieldCategories.add(v);
          else unresolved.push(value);
          break;
        }
        case "UNIVERSITY":
          institutionTypes.add(value.trim());
          break;
        default:
          break;
      }
    }
  }

  // A list naming every category is not a constraint. Keeping it would add a
  // pointless IN clause and, worse, read as a deliberate restriction.
  if (fieldCategories.size === FIELD_CATEGORIES.size) fieldCategories.clear();
  if (degreeLevels.size === DEGREE_LEVELS.size) degreeLevels.clear();

  return {
    countries: [...countries].sort(),
    degreeLevels: [...degreeLevels].sort(),
    fieldCategories: [...fieldCategories].sort(),
    institutionTypes: [...institutionTypes].sort(),
    unresolved: [...new Set(unresolved)].sort(),
  };
}

/**
 * Whether a rule set is specific enough to expand across the catalogue.
 *
 * Degree level alone is deliberately not enough. "Open to master's students"
 * is true of essentially every master's programme on earth; expanding it would
 * produce tens of thousands of rows that say nothing. Such a scholarship keeps
 * its eligibility rules and is still evaluated per student at match time —
 * that, not a wall of links, is the correct representation of a scholarship
 * with no spatial or subject bound.
 */
export function isLinkable(rules: ScholarshipRules): boolean {
  return rules.countries.length > 0 || rules.fieldCategories.length > 0;
}
