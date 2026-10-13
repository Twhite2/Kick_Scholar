import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ProgramFilterPanel } from "@/components/programs/program-filter-panel";
import { ProgramCard, type ProgramCardData } from "@/components/programs/program-card";
import { Pager } from "@/components/ui/pager";
import { PAGE_SIZE, pageByMatch, parsePage } from "@/lib/pagination";
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
  const page = parsePage(params.page);

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

  const userId = session.user.id;
  const [total, matches, saved] = await Promise.all([
    prisma.program.count({ where }),
    // Only matches inside the current filter, best first — this is the
    // ordering "Best match" pages through.
    prisma.match.findMany({
      where: { userId, matchType: "PROGRAM", program: where },
      orderBy: { score: "desc" },
      select: { programId: true, score: true, matchStrength: true },
    }),
    prisma.savedOpportunity.findMany({
      where: { userId, opportunityType: "PROGRAM" },
      select: { programId: true },
    }),
  ]);

  const include = { university: true } as const;
  const programs =
    sort === "match"
      ? await pageByMatch({
          matchedIds: matches.flatMap((m) => (m.programId ? [m.programId] : [])),
          page,
          fetchByIds: (ids) => prisma.program.findMany({ where: { id: { in: ids } }, include }),
          fetchUnmatched: (excludeIds, skip, take) =>
            prisma.program.findMany({
              where: { AND: [where, { id: { notIn: excludeIds } }] },
              include,
              orderBy: { name: "asc" },
              skip,
              take,
            }),
        })
      : await prisma.program.findMany({
          where,
          include,
          orderBy: sort === "tuition" ? { tuitionAmount: "asc" } : { name: "asc" },
          skip: (page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
        });

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

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 md:px-8 md:py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Programs</h1>
        <p className="mt-1 text-muted-foreground">{total} programs found</p>
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

      <Pager pathname="/programs" params={params} page={page} totalPages={Math.ceil(total / PAGE_SIZE)} />
    </div>
  );
}
