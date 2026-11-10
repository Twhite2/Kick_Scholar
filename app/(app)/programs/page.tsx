import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ProgramFilterPanel } from "@/components/programs/program-filter-panel";
import { ProgramCard, type ProgramCardData } from "@/components/programs/program-card";
import { Pagination } from "@/components/ui/pagination";
import type { DegreeLevel, FieldCategory, TuitionType, Prisma } from "@/lib/generated/prisma/client";

/**
 * Divisible by both grid widths (2 and 3 columns), so the last row is never
 * ragged at either breakpoint.
 */
const PAGE_SIZE = 24;

export default async function ProgramsPage({ searchParams }: PageProps<"/programs">) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = session.user.id;

  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : undefined;
  const country = typeof params.country === "string" ? params.country : undefined;
  const degree = typeof params.degree === "string" ? params.degree : undefined;
  const field = typeof params.field === "string" ? params.field : undefined;
  const tuition = typeof params.tuition === "string" ? params.tuition : undefined;
  const sort = typeof params.sort === "string" ? params.sort : "match";
  const requestedPage = Number(typeof params.page === "string" ? params.page : "1");
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.floor(requestedPage) : 1;

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

  // The catalogue is 1,400+ programmes and growing with every crawl. Rendering
  // it whole is what this page used to do; it now returns one page at a time.
  const total = await prisma.program.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const skip = (currentPage - 1) * PAGE_SIZE;

  const [matches, saved] = await Promise.all([
    prisma.match.findMany({
      where: { userId, matchType: "PROGRAM" },
      select: { programId: true, score: true, matchStrength: true },
    }),
    prisma.savedOpportunity.findMany({
      where: { userId, opportunityType: "PROGRAM" },
      select: { programId: true },
    }),
  ]);

  let programs: Prisma.ProgramGetPayload<{ include: { university: true } }>[];

  if (sort === "match") {
    // Match scores live in a per-user Match table, so the database cannot order
    // the Program query by them. Ordering the page slice alone would be wrong —
    // it would sort 24 arbitrary rows rather than pick the best 24 — so the
    // filtered id set is ordered first and only the chosen page is hydrated.
    // Ids are cheap: no joins and no row payload, unlike the full fetch this
    // replaces.
    const ids = await prisma.program.findMany({ where, select: { id: true } });
    const scoreById = new Map(matches.map((m) => [m.programId, m.score]));
    const pageIds = ids
      .map((r) => r.id)
      .sort((a, b) => (scoreById.get(b) ?? -1) - (scoreById.get(a) ?? -1))
      .slice(skip, skip + PAGE_SIZE);

    const rows = await prisma.program.findMany({
      where: { id: { in: pageIds } },
      include: { university: true },
    });
    // `IN` does not preserve the order it was given, so restore it here.
    const byId = new Map(rows.map((r) => [r.id, r]));
    programs = pageIds.map((id) => byId.get(id)).filter((p) => p !== undefined);
  } else {
    programs = await prisma.program.findMany({
      where,
      include: { university: true },
      orderBy: sort === "tuition" ? { tuitionAmount: "asc" } : { name: "asc" },
      skip,
      take: PAGE_SIZE,
    });
  }

  const matchByProgram = new Map(matches.map((m) => [m.programId, m]));
  const savedProgramIds = new Set(saved.map((s) => s.programId));

  const cards: ProgramCardData[] = programs.map((p) => {
    const match = matchByProgram.get(p.id);
    return {
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
      saved: savedProgramIds.has(p.id),
    };
  });

  const rangeStart = total === 0 ? 0 : skip + 1;
  const rangeEnd = skip + cards.length;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 md:px-8 md:py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Programs</h1>
        <p className="mt-1 text-muted-foreground">
          {total === 0
            ? "0 programs found"
            : `Showing ${rangeStart}–${rangeEnd} of ${total} programs`}
        </p>
      </div>

      <ProgramFilterPanel />

      {cards.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
          No programs match your filters yet.
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((program) => (
              <ProgramCard key={program.id} program={program} />
            ))}
          </div>
          <Pagination
            basePath="/programs"
            params={params}
            page={currentPage}
            totalPages={totalPages}
          />
        </>
      )}
    </div>
  );
}
