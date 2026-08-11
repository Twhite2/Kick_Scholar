import Link from "next/link";
import { redirect } from "next/navigation";
import { GraduationCap, Award, PiggyBank, Trophy } from "lucide-react";
import { auth } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard/getDashboardData";
import { HeroMatchScore } from "@/components/dashboard/hero-match-score";
import { StatCard } from "@/components/dashboard/stat-card";
import { JourneyProgressPath } from "@/components/dashboard/journey-progress-path";
import { FundingByCountry } from "@/components/dashboard/funding-by-country";
import { DeadlinesTimeline } from "@/components/dashboard/deadlines-timeline";
import { MissingRequirementCard } from "@/components/dashboard/missing-requirement-card";
import { Button } from "@/components/ui/button";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const firstName = session.user.name?.split(" ")[0] ?? "there";
  const data = await getDashboardData(session.user.id);

  if (!data.hasProfile) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center md:px-8">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Welcome, {firstName}</h1>
        <p className="mt-2 text-muted-foreground">
          Complete your profile and we&apos;ll show you exactly which programs and scholarships you qualify for.
        </p>
        <Button size="lg" className="mt-6" render={<Link href="/profile">Complete your profile</Link>} />
      </div>
    );
  }

  const journeySteps = [
    { label: "Profile", detail: `${Math.round(data.profileCompleteness * 100)}% complete`, done: data.profileCompleteness >= 0.8 },
    { label: "Discover", detail: `${data.programMatchCount} programs`, done: data.programMatchCount > 0 },
    { label: "Fund", detail: `${data.scholarshipMatchCount} scholarships`, done: data.scholarshipMatchCount > 0 },
    { label: "Apply", detail: `${data.applicationCount} applications`, done: data.applicationCount > 0 },
    { label: "Study Abroad", detail: data.acceptedCount > 0 ? "Accepted!" : "Not yet", done: data.acceptedCount > 0 },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 md:px-8 md:py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Welcome back, {firstName}</h1>
        <p className="mt-1 text-muted-foreground">Here&apos;s what you qualify for right now.</p>
      </div>

      <HeroMatchScore
        score={data.overallScore}
        programCount={data.programMatchCount}
        scholarshipCount={data.scholarshipMatchCount}
        topCountries={data.strongestCountries.map((c) => c.countryName)}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Program Matches" value={data.programMatchCount} icon={<GraduationCap />} />
        <StatCard label="Scholarship Matches" value={data.scholarshipMatchCount} icon={<Award />} />
        <StatCard label="Fully Funded" value={data.fullyFundedCount} icon={<PiggyBank />} accent="success" />
        <StatCard label="Top Match" value={data.topMatch?.score ?? 0} icon={<Trophy />} accent="success" />
      </div>

      <JourneyProgressPath steps={journeySteps} />

      <div className="grid gap-6 lg:grid-cols-2">
        <FundingByCountry countries={data.strongestCountries} />
        <DeadlinesTimeline deadlines={data.upcomingDeadlines} />
      </div>

      {data.missingRequirements.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Insights for You
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {data.missingRequirements.map((r) => (
              <MissingRequirementCard key={r.label} {...r} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
