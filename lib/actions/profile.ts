"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { runMatchForStudent } from "@/lib/matching/runMatchForStudent";
import { profileInputSchema, type ProfileInput } from "./profile-schema";

// Fields that count toward "profile strength" (Phase 5's completion ring).
// Kept intentionally small — the fields that most directly unlock or block
// matching, not everything on the model.
function computeCompleteness(input: ProfileInput): number {
  const checks = [
    !!input.nationality,
    !!input.currentEducationLevel,
    input.currentGpa !== null,
    !!input.desiredDegreeLevel,
    input.desiredFields.length > 0,
    input.preferredCountries.length > 0,
    input.budgetMaxPerYear !== null,
    input.languageProficiencies.length > 0,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100) / 100;
}

export interface UpdateProfileResult {
  error?: string;
  profileCompleteness?: number;
  programMatches?: number;
  scholarshipMatches?: number;
}

/**
 * Saves the current user's StudentProfile, then immediately recomputes
 * their matches — this is the "creating a profile and saving it produces a
 * populated, explainable Match list" wiring the plan calls for. Phase 5's
 * profile form calls this directly (not via a <form action>, since the
 * input is structured/nested — react-hook-form validates client-side
 * against the same profileInputSchema, then calls this as a plain async
 * function with the parsed object).
 */
export async function updateProfile(input: ProfileInput): Promise<UpdateProfileResult> {
  const session = await auth();
  if (!session?.user) {
    return { error: "Not signed in." };
  }

  const parsed = profileInputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid profile data" };
  }
  const data = parsed.data;
  const profileCompleteness = computeCompleteness(data);

  await prisma.studentProfile.upsert({
    where: { userId: session.user.id },
    update: {
      nationality: data.nationality,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
      currentEducationLevel: data.currentEducationLevel,
      currentGpa: data.currentGpa,
      gpaScale: data.gpaScale,
      fieldOfStudy: data.fieldOfStudy,
      desiredDegreeLevel: data.desiredDegreeLevel,
      desiredFields: data.desiredFields,
      preferredCountries: data.preferredCountries,
      budgetMaxPerYear: data.budgetMaxPerYear,
      budgetCurrency: data.budgetCurrency,
      workExperienceMonths: data.workExperienceMonths,
      financialNeedSelfReported: data.financialNeedSelfReported,
      profileCompleteness,
      languageProficiencies: {
        deleteMany: {},
        create: data.languageProficiencies,
      },
    },
    create: {
      userId: session.user.id,
      nationality: data.nationality,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
      currentEducationLevel: data.currentEducationLevel,
      currentGpa: data.currentGpa,
      gpaScale: data.gpaScale,
      fieldOfStudy: data.fieldOfStudy,
      desiredDegreeLevel: data.desiredDegreeLevel,
      desiredFields: data.desiredFields,
      preferredCountries: data.preferredCountries,
      budgetMaxPerYear: data.budgetMaxPerYear,
      budgetCurrency: data.budgetCurrency,
      workExperienceMonths: data.workExperienceMonths,
      financialNeedSelfReported: data.financialNeedSelfReported,
      profileCompleteness,
      languageProficiencies: { create: data.languageProficiencies },
    },
  });

  const { programMatches, scholarshipMatches } = await runMatchForStudent(prisma, session.user.id);

  return { profileCompleteness, programMatches, scholarshipMatches };
}
