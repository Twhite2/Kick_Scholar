import type { ExtractedUniversity } from "../extraction/schemas";
import { canonicalizeUrl } from "./canonicalUrl";
import { universityDedupeKey } from "./generateDedupeKey";
import { isKnownCountry } from "../constants/countries";

export interface NormalizedUniversity {
  dedupeKey: string;
  name: string;
  country: string;
  city: string;
  website: string;
  description: string | null;
  warnings: string[];
}

export function normalizeUniversity(input: ExtractedUniversity): NormalizedUniversity {
  const warnings: string[] = [];
  const country = input.country.toUpperCase();
  if (!isKnownCountry(country)) {
    warnings.push(`Country ${country} is outside the initial target-country list — proceeding anyway.`);
  }

  return {
    dedupeKey: universityDedupeKey(input.name, country),
    name: input.name.trim(),
    country,
    city: input.city.trim(),
    website: canonicalizeUrl(input.website),
    description: input.description?.trim() || null,
    warnings,
  };
}
