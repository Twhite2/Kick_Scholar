import type { AuthorityLevel } from "../generated/prisma/enums";

const AUTHORITY_RANK: Record<AuthorityLevel, number> = { PRIMARY: 3, SECONDARY: 2, DISCOVERY: 1 };

export function isStrictlyHigherAuthority(candidate: AuthorityLevel, existing: AuthorityLevel): boolean {
  return AUTHORITY_RANK[candidate] > AUTHORITY_RANK[existing];
}

/**
 * A new source may overwrite a scalar field only if the field was
 * previously null, or the new source has strictly higher authority than the
 * record's current primary source. Otherwise the new source is recorded
 * only as a corroborating SourceCitation (see lib/pipeline/loadExtractedToDb.ts)
 * — it never silently clobbers an equally- or lower-authority existing value.
 */
export function shouldOverwriteScalar(
  existingValue: unknown,
  existingAuthority: AuthorityLevel,
  candidateAuthority: AuthorityLevel,
): boolean {
  if (existingValue === null || existingValue === undefined) return true;
  return isStrictlyHigherAuthority(candidateAuthority, existingAuthority);
}
