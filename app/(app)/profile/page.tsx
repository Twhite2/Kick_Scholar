import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ProfileForm } from "@/components/profile/profile-form";
import { ProfileCompletionRing } from "@/components/profile/profile-completion-ring";
import type { ProfileInput } from "@/lib/actions/profile-schema";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    include: { languageProficiencies: true },
  });

  const defaultValues: ProfileInput = {
    nationality: profile?.nationality ?? null,
    dateOfBirth: profile?.dateOfBirth ? profile.dateOfBirth.toISOString().slice(0, 10) : null,
    currentEducationLevel: profile?.currentEducationLevel ?? null,
    currentGpa: profile?.currentGpa ? Number(profile.currentGpa) : null,
    gpaScale: profile?.gpaScale ? Number(profile.gpaScale) : null,
    fieldOfStudy: profile?.fieldOfStudy ?? null,
    desiredDegreeLevel: profile?.desiredDegreeLevel ?? null,
    desiredFields: profile?.desiredFields ?? [],
    preferredCountries: profile?.preferredCountries ?? [],
    budgetMaxPerYear: profile?.budgetMaxPerYear ? Number(profile.budgetMaxPerYear) : null,
    budgetCurrency: profile?.budgetCurrency ?? null,
    workExperienceMonths: profile?.workExperienceMonths ?? null,
    financialNeedSelfReported: profile?.financialNeedSelfReported ?? null,
    languageProficiencies:
      profile?.languageProficiencies.map((p) => ({
        testName: p.testName,
        score: p.score ? Number(p.score) : null,
        cefrLevel: p.cefrLevel,
      })) ?? [],
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-8 md:py-12">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Your profile</h1>
          <p className="mt-1 text-muted-foreground">
            The more complete your profile, the more precisely we can match you.
          </p>
        </div>
        <ProfileCompletionRing completeness={profile?.profileCompleteness ?? 0} />
      </div>
      <ProfileForm defaultValues={defaultValues} />
    </div>
  );
}
