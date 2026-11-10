import { z } from "zod";
import { TARGET_COUNTRIES } from "@/lib/constants/countries";

// Lives outside lib/actions/profile.ts on purpose: a "use server" file may
// only export async functions — a zod schema (or any other value) exported
// alongside them gets stripped/stubbed in the client bundle, which breaks
// zodResolver() with a cryptic "not a Zod schema" error when a client
// component imports it. This file has no "use server" directive, so both
// the server action and the client form can import the real schema.

/** Budget currencies offered in the profile (ISO 4217). */
export const BUDGET_CURRENCIES = ["EUR", "GBP", "USD", "SEK", "NOK", "DKK", "CHF", "NGN"] as const;

// Number inputs registered with valueAsNumber give NaN when empty; treat that
// as "not given" rather than an error.
const optionalNumber = (message: string) =>
  z.preprocess((v) => (typeof v === "number" && Number.isNaN(v) ? null : v), z.number({ message }).nullable());

const languageProficiencySchema = z.object({
  testName: z.string().trim().min(1, "Name the test, for example IELTS"),
  score: optionalNumber("Enter the score as a number"),
  cefrLevel: z.string().nullable(),
});

export const profileInputSchema = z.object({
  nationality: z.string().nullable(),
  dateOfBirth: z.iso.date({ message: "Enter a full date of birth" }).nullable(),
  currentEducationLevel: z
    .enum(["HIGH_SCHOOL", "BACHELOR", "MASTER", "PHD", "DIPLOMA", "CERTIFICATE", "OTHER"])
    .nullable(),
  currentGpa: optionalNumber("Enter your CGPA as a number, for example 3.6").refine(
    (v) => v === null || v >= 0,
    "Your CGPA can't be negative",
  ),
  gpaScale: optionalNumber("Enter the scale as a number, for example 5").refine(
    (v) => v === null || v > 0,
    "The scale must be above zero",
  ),
  fieldOfStudy: z.string().nullable(),
  desiredDegreeLevel: z
    .enum(["HIGH_SCHOOL", "BACHELOR", "MASTER", "PHD", "DIPLOMA", "CERTIFICATE", "OTHER"])
    .nullable(),
  desiredFields: z.array(z.string()),
  preferredCountries: z.array(
    z.string().refine((code) => code in TARGET_COUNTRIES, "Unknown country code"),
  ),
  budgetMaxPerYear: optionalNumber("Enter your budget as a number").refine(
    (v) => v === null || v >= 0,
    "Your budget can't be negative",
  ),
  budgetCurrency: z.string().nullable(),
  workExperienceMonths: optionalNumber("Enter months of experience as a number").refine(
    (v) => v === null || (Number.isInteger(v) && v >= 0),
    "Enter whole months, for example 18",
  ),
  financialNeedSelfReported: z.boolean().nullable(),
  languageProficiencies: z.array(languageProficiencySchema),
});

/** Parsed values, as saved. */
export type ProfileInput = z.infer<typeof profileInputSchema>;
/** What the form holds before parsing (number inputs may be NaN). */
export type ProfileFormValues = z.input<typeof profileInputSchema>;
