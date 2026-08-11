import type { ExtractedScholarship } from "../extraction/schemas";
import { canonicalizeUrl } from "./canonicalUrl";
import { scholarshipDedupeKey } from "./generateDedupeKey";

export interface NormalizedScholarship {
  dedupeKey: string;
  name: string;
  providerName: string;
  providerType: ExtractedScholarship["providerType"];
  country: string | null;
  amount: number | null;
  amountCurrency: string | null;
  coverageType: ExtractedScholarship["coverageType"];
  description: string | null;
  applicationUrl: string;
  deadlineText: string | null;
  isRenewable: boolean | null;
  discoveredFrom: string | null;
  discoveryUrl: string | null;
  officialSourceUrl: string | null;
  warnings: string[];
}

export function normalizeScholarship(input: ExtractedScholarship): NormalizedScholarship {
  const warnings: string[] = [];

  if (input.discoveredFrom && !input.officialSourceUrl) {
    warnings.push(
      "Discovery-sourced scholarship has no officialSourceUrl yet — will stay UNVERIFIED until one is found.",
    );
  }

  return {
    dedupeKey: scholarshipDedupeKey(input.name, input.providerName),
    name: input.name.trim(),
    providerName: input.providerName.trim(),
    providerType: input.providerType,
    country: input.country?.toUpperCase() ?? null,
    amount: input.amount,
    amountCurrency: input.amountCurrency,
    coverageType: input.coverageType,
    description: input.description?.trim() || null,
    applicationUrl: canonicalizeUrl(input.applicationUrl),
    deadlineText: input.deadlineText,
    isRenewable: input.isRenewable,
    discoveredFrom: input.discoveredFrom,
    discoveryUrl: input.discoveryUrl ? canonicalizeUrl(input.discoveryUrl) : null,
    officialSourceUrl: input.officialSourceUrl ? canonicalizeUrl(input.officialSourceUrl) : null,
    warnings,
  };
}
