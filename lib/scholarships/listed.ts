/**
 * Which scholarships students see.
 *
 * A REJECTED scholarship is one an admin or the record cleanup decided is not
 * an award (a provider's "About us" or "Find a course" page captured as a
 * scholarship). It stays in the database, so the decision can be reversed
 * and the pipeline, which never overwrites an existing record's status, does
 * not bring it back; but nothing a student sees may list, match or link it.
 */
export const LISTED_SCHOLARSHIP = { verificationStatus: { not: "REJECTED" } } as const;

/** Who or what made a scholarship unlisted, kept in `verifiedBy`. */
export const NOT_AN_AWARD = "system:not-an-award";

export function isListedScholarship(s: { verificationStatus: string }): boolean {
  return s.verificationStatus !== "REJECTED";
}
