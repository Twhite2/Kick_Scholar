import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ProfileForm } from "@/components/profile/profile-form";
import type { ProfileInput } from "@/lib/actions/profile-schema";
import { isKnownCountry } from "@/lib/constants/countries";
import { countryNameOptions } from "@/lib/ui/country";
import { ISO_COUNTRY_CODES } from "@/lib/ui/iso-countries";

export const metadata: Metadata = { title: "Your profile" };

/** Completeness as a ring styled like the score dial (§9.8). */
function CompletenessRing({ completeness }: { completeness: number }) {
  const added = Math.round(completeness * 8);
  const value = Math.round(completeness * 100);
  return (
    <div className="flex items-center gap-3.5">
      <div role="img" aria-label={`${added} of 8 details added`} className="relative inline-flex size-[60px] items-center justify-center rounded-full bg-white shadow-tile-on-white">
        <svg width={60} height={60} viewBox="0 0 60 60" className="absolute inset-0" aria-hidden="true">
          <circle cx={30} cy={30} r={25} fill="none" strokeWidth={5} stroke="var(--track)" />
          <circle
            cx={30}
            cy={30}
            r={25}
            fill="none"
            strokeWidth={5}
            stroke={value >= 100 ? "var(--kick-green)" : "var(--kick-blue)"}
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={`${value} 100`}
            transform="rotate(-90 30 30)"
            className="ks-dial-arc"
            data-animate="true"
          />
        </svg>
        <span aria-hidden="true" className="relative font-display text-[17px] font-[750] tabular-nums">
          {added}/8
        </span>
      </div>
      <p className="text-[15px] font-bold text-ink">{added} of 8 details added</p>
    </div>
  );
}

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

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
    // Older profiles were free text ("GE", "germany"); keep only real codes so
    // the form can still be saved.
    preferredCountries: (profile?.preferredCountries ?? []).map((c) => c.toUpperCase()).filter(isKnownCountry),
    budgetMaxPerYear: profile?.budgetMaxPerYear ? Number(profile.budgetMaxPerYear) : null,
    budgetCurrency: profile?.budgetCurrency ?? "EUR",
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
    <div className="box-content max-w-[860px] px-gutter pt-6 pb-16 md:pt-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="type-page-h1 text-ink">Your profile</h1>
          <p className="mt-2 type-body-sm text-ink-3">The more complete your profile, the more precisely we can match you.</p>
        </div>
        <CompletenessRing completeness={profile?.profileCompleteness ?? 0} />
      </div>
      <ProfileForm defaultValues={defaultValues} nationalityOptions={countryNameOptions(ISO_COUNTRY_CODES)} />
    </div>
  );
}
