import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ProgramCard, type ProgramCardData } from "@/components/programs/program-card";
import { ScholarshipCard, type ScholarshipCardData } from "@/components/scholarships/scholarship-card";
import { StartApplicationButton } from "@/components/applications/start-application-button";

export default async function SavedPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [saved, matches] = await Promise.all([
    prisma.savedOpportunity.findMany({
      where: { userId: session.user.id },
      include: { program: { include: { university: true } }, scholarship: true },
      orderBy: { savedAt: "desc" },
    }),
    prisma.match.findMany({ where: { userId: session.user.id } }),
  ]);

  const matchByProgram = new Map(matches.filter((m) => m.programId).map((m) => [m.programId, m]));
  const matchByScholarship = new Map(matches.filter((m) => m.scholarshipId).map((m) => [m.scholarshipId, m]));

  const savedPrograms = saved.filter((s) => s.program);
  const savedScholarships = saved.filter((s) => s.scholarship);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 md:px-8 md:py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Saved</h1>
        <p className="mt-1 text-muted-foreground">Opportunities you&apos;ve bookmarked for later.</p>
      </div>

      {saved.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
          Nothing saved yet — browse Programs or Scholarships and tap the bookmark icon.
        </div>
      )}

      {savedPrograms.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Programs</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {savedPrograms.map((s) => {
              const p = s.program!;
              const match = matchByProgram.get(p.id);
              const card: ProgramCardData = {
                id: p.id,
                name: p.name,
                degreeLevel: p.degreeLevel,
                fieldOfStudy: p.fieldOfStudy,
                durationMonths: p.durationMonths,
                tuitionType: p.tuitionType,
                tuitionAmount: p.tuitionAmount ? Number(p.tuitionAmount) : null,
                tuitionCurrency: p.tuitionCurrency,
                university: { name: p.university.name, country: p.university.country, city: p.university.city },
                match: match ? { score: match.score, matchStrength: match.matchStrength } : null,
                saved: true,
              };
              return (
                <div key={s.id} className="space-y-2">
                  <ProgramCard program={card} />
                  <StartApplicationButton targetType="PROGRAM" targetId={p.id} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {savedScholarships.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Scholarships</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {savedScholarships.map((s) => {
              const sc = s.scholarship!;
              const match = matchByScholarship.get(sc.id);
              const card: ScholarshipCardData = {
                id: sc.id,
                name: sc.name,
                providerName: sc.providerName,
                country: sc.country,
                coverageType: sc.coverageType,
                amount: sc.amount ? Number(sc.amount) : null,
                amountCurrency: sc.amountCurrency,
                deadlineText: sc.deadlineText,
                verified: sc.verified,
                match: match ? { score: match.score, matchStrength: match.matchStrength } : null,
                saved: true,
              };
              return (
                <div key={s.id} className="space-y-2">
                  <ScholarshipCard scholarship={card} />
                  <StartApplicationButton targetType="SCHOLARSHIP" targetId={sc.id} />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
