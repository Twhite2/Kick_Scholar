import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ProgramFilterPanel } from "@/components/programs/program-filter-panel";
import { ProgramCard, type ProgramCardData } from "@/components/programs/program-card";
import type { DegreeLevel, FieldCategory, TuitionType, Prisma } from "@/lib/generated/prisma/client";

export default async function ProgramsPage({ searchParams }: PageProps<"/programs">) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : undefined;
  const country = typeof params.country === "string" ? params.country : undefined;
  const degree = typeof params.degree === "string" ? params.degree : undefined;
  const field = typeof params.field === "string" ? params.field : undefined;
  const tuition = typeof params.tuition === "string" ? params.tuition : undefined;
  const sort = typeof params.sort === "string" ? params.sort : "match";

  const where: Prisma.ProgramWhereInput = {
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { university: { name: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
    ...(country ? { university: { country } } : {}),
    ...(degree ? { degreeLevel: degree as DegreeLevel } : {}),
    ...(field ? { fieldCategory: field as FieldCategory } : {}),
    ...(tuition ? { tuitionType: tuition as TuitionType } : {}),
  };

  const [programs, matches, saved] = await Promise.all([
    prisma.program.findMany({
      where,
      include: { university: true },
      orderBy: sort === "name" ? { name: "asc" } : sort === "tuition" ? { tuitionAmount: "asc" } : undefined,
    }),
    prisma.match.findMany({ where: { userId: session.user.id, matchType: "PROGRAM" } }),
    prisma.savedOpportunity.findMany({ where: { userId: session.user.id, opportunityType: "PROGRAM" } }),
  ]);

  const matchByProgram = new Map(matches.map((m) => [m.programId, m]));
  const savedProgramIds = new Set(saved.map((s) => s.programId));

  const cards: ProgramCardData[] = programs.map((p) => ({
    id: p.id,
    name: p.name,
    degreeLevel: p.degreeLevel,
    fieldOfStudy: p.fieldOfStudy,
    durationMonths: p.durationMonths,
    tuitionType: p.tuitionType,
    tuitionAmount: p.tuitionAmount ? Number(p.tuitionAmount) : null,
    tuitionCurrency: p.tuitionCurrency,
    university: { name: p.university.name, country: p.university.country, city: p.university.city },
    match: matchByProgram.has(p.id)
      ? { score: matchByProgram.get(p.id)!.score, matchStrength: matchByProgram.get(p.id)!.matchStrength }
      : null,
    saved: savedProgramIds.has(p.id),
  }));

  if (sort === "match") {
    cards.sort((a, b) => (b.match?.score ?? -1) - (a.match?.score ?? -1));
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 md:px-8 md:py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Programs</h1>
        <p className="mt-1 text-muted-foreground">{cards.length} programs found</p>
      </div>

      <ProgramFilterPanel />

      {cards.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
          No programs match your filters yet.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((program) => (
            <ProgramCard key={program.id} program={program} />
          ))}
        </div>
      )}
    </div>
  );
}
