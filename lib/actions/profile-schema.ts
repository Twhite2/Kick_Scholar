import { z } from "zod";

// Lives outside lib/actions/profile.ts on purpose: a "use server" file may
// only export async functions — a zod schema (or any other value) exported
// alongside them gets stripped/stubbed in the client bundle, which breaks
// zodResolver() with a cryptic "not a Zod schema" error when a client
// component imports it. This file has no "use server" directive, so both
// the server action and the client form can import the real schema.

const languageProficiencySchema = z.object({
  testName: z.string().min(1),
  score: z.number().nullable(),
  cefrLevel: z.string().nullable(),
});

export const profileInputSchema = z.object({
  nationality: z.string().nullable(),
  dateOfBirth: z.iso.date().nullable(),
  currentEducationLevel: z
    .enum(["HIGH_SCHOOL", "BACHELOR", "MASTER", "PHD", "DIPLOMA", "CERTIFICATE", "OTHER"])
    .nullable(),
  currentGpa: z.number().nullable(),
  gpaScale: z.number().nullable(),
  fieldOfStudy: z.string().nullable(),
  desiredDegreeLevel: z
    .enum(["HIGH_SCHOOL", "BACHELOR", "MASTER", "PHD", "DIPLOMA", "CERTIFICATE", "OTHER"])
    .nullable(),
  desiredFields: z.array(z.string()),
  preferredCountries: z.array(z.string()),
  budgetMaxPerYear: z.number().nullable(),
  budgetCurrency: z.string().nullable(),
  workExperienceMonths: z.number().nullable(),
  financialNeedSelfReported: z.boolean().nullable(),
  languageProficiencies: z.array(languageProficiencySchema),
});

export type ProfileInput = z.infer<typeof profileInputSchema>;
