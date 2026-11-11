import { countryName } from "@/lib/ui/country";

/**
 * Which of a programme's deadlines apply to a student.
 *
 * German universities often set one deadline for EU applicants and an
 * earlier one for everyone else; the loader keeps the group in the
 * deadline's intake label ("Winter semester (non-EU applicants)"). A
 * student should never be shown the other group's date as their own. With
 * no nationality on file every date is kept, so the earliest one, the one
 * that must not be missed, still shows.
 */

export type ApplicantGroup = "EU" | "NON_EU";

/** EU members plus the EEA and Switzerland, which German admissions treat alike. */
const EU_EEA = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU",
  "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "IS", "LI", "NO", "CH",
];

let euNames: Set<string> | null = null;

/** The profile stores nationality as an en-GB country name ("Nigeria"); codes are accepted too. */
export function applicantGroupFor(nationality: string | null | undefined): ApplicantGroup | null {
  const value = nationality?.trim();
  if (!value) return null;
  if (/^[A-Za-z]{2}$/.test(value)) return EU_EEA.includes(value.toUpperCase()) ? "EU" : "NON_EU";
  euNames ??= new Set(EU_EEA.map((code) => countryName(code).toLowerCase()));
  // Common alternative spellings of member states' names.
  const lower = value.toLowerCase();
  if (euNames.has(lower) || lower === "czech republic" || lower === "the netherlands") return "EU";
  return "NON_EU";
}

const EU_ONLY = "(EU applicants)";
const NON_EU_ONLY = "(non-EU applicants)";

/** True when a deadline with this intake label applies to the student's group. */
export function deadlineAppliesTo(intake: string | null | undefined, group: ApplicantGroup | null): boolean {
  if (!group || !intake) return true;
  if (intake.includes(EU_ONLY)) return group === "EU";
  if (intake.includes(NON_EU_ONLY)) return group === "NON_EU";
  return true;
}

/**
 * The same rule as a Prisma `where` on ApplicationDeadline, for queries that
 * take only the next date. Null intakes are kept explicitly: SQL's NOT LIKE
 * drops them otherwise.
 */
export function deadlineWhereFor(group: ApplicantGroup | null) {
  if (!group) return {};
  const other = group === "EU" ? NON_EU_ONLY : EU_ONLY;
  return { OR: [{ intake: null }, { NOT: { intake: { contains: other } } }] };
}

/** "Winter semester (non-EU applicants)" -> "Winter semester, non-EU applicants" for display. */
export function intakeLabel(intake: string | null | undefined): string | null {
  if (!intake) return null;
  const tidy = intake.replace(/\s*\(([^)]+)\)\s*$/, (_, g: string) => `, ${g}`).replace(/^,\s*/, "");
  return tidy.charAt(0).toUpperCase() + tidy.slice(1);
}
