import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ScholarshipFilterPanel } from "@/components/scholarships/scholarship-filter-panel";
import { ScholarshipCard, type ScholarshipCardData } from "@/components/scholarships/scholarship-card";
import { Pagination } from "@/components/ui/pagination";
import type { Prisma, ScholarshipCoverageType } from "@/lib/generated/prisma/client";

/**
 * Divisible by both grid widths (2 and 3 columns), so the last row is never
 * ragged at either breakpoint.
 */
const PAGE_SIZE = 24;

export default async function ScholarshipsPage({ searchParams }: PageProps<"/scholarships">) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = session.user.id;

  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : undefined;
  const country = typeof params.country === "string" ? params.country : undefined;
  const coverage = typeof params.coverage === "string" ? params.coverage : undefined;
  const verifiedOnly = params.verified === "true";
  const requestedPage = Number(typeof params.page === "string" ? params.page : "1");
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.floor(requestedPage) : 1;

  const where: Prisma.ScholarshipWhereInput = {
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { providerName: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(country ? { country } : {}),
    ...(coverage ? { coverageType: coverage as ScholarshipCoverageType } : {}),
    ...(verifiedOnly ? { verified: true } : {}),
  };

  // This page used to fetch and render every scholarship. That was survivable
  // at 151 rows and hangs the browser at 1,700 — Chrome reports it as
  // RESULT_CODE_HUNG rather than as an error, so it looks like a crash rather
  // than a slow page. One page at a time now.
  const total = await prisma.scholarship.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const skip = (currentPage - 1) * PAGE_SIZE;

  const [matches, saved] = await Promise.all([
    prisma.match.findMany({
      where: { userId, matchType: "SCHOLARSHIP" },
      select: { scholarshipId: true, score: true, matchStrength: true },
    }),
    prisma.savedOpportunity.findMany({
      where: { userId, opportunityType: "SCHOLARSHIP" },
      select: { scholarshipId: true },
    }),
  ]);

  // Match scores live in a per-user Match table, so the database cannot order
  // the Scholarship query by them. Ordering only the page slice would be wrong:
  // it would sort 24 arbitrary rows rather than pick the best 24. So the
  // filtered id set is ordered first and only the chosen page is hydrated. Ids
  // are cheap — no row payload, unlike the full fetch this replaces.
  const ids = await prisma.scholarship.findMany({ where, select: { id: true } });
  const scoreById = new Map(matches.map((m) => [m.scholarshipId, m.score]));
  const pageIds = ids
    .map((r) => r.id)
    .sort((a, b) => (scoreById.get(b) ?? -1) - (scoreById.get(a) ?? -1))
    .slice(skip, skip + PAGE_SIZE);

  const rows = await prisma.scholarship.findMany({ where: { id: { in: pageIds } } });
  // `IN` does not preserve the order it was given, so restore it here.
  const byId = new Map(rows.map((r) => [r.id, r]));
  const scholarships = pageIds.map((id) => byId.get(id)).filter((s) => s !== undefined);

  const matchByScholarship = new Map(matches.map((m) => [m.scholarshipId, m]));
  const savedIds = new Set(saved.map((s) => s.scholarshipId));

  const cards: ScholarshipCardData[] = scholarships.map((s) => {
    const match = matchByScholarship.get(s.id);
    return {
      id: s.id,
      name: s.name,
      providerName: s.providerName,
      country: s.country,
      coverageType: s.coverageType,
      amount: s.amount ? Number(s.amount) : null,
      amountCurrency: s.amountCurrency,
      deadlineText: s.deadlineText,
      verified: s.verified,
      match: match ? { score: match.score, matchStrength: match.matchStrength } : null,
      saved: savedIds.has(s.id),
    };
  });

  const rangeStart = total === 0 ? 0 : skip + 1;
  const rangeEnd = skip + cards.length;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 md:px-8 md:py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Scholarships</h1>
        <p className="mt-1 text-muted-foreground">
          {total === 0
            ? "0 scholarships found"
            : `Showing ${rangeStart}–${rangeEnd} of ${total} scholarships`}
        </p>
      </div>

      <ScholarshipFilterPanel />

      {cards.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
          No scholarships match your filters yet.
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((scholarship) => (
              <ScholarshipCard key={scholarship.id} scholarship={scholarship} />
            ))}
          </div>
          <Pagination
            basePath="/scholarships"
            params={params}
            page={currentPage}
            totalPages={totalPages}
          />
        </>
      )}
    </div>
  );
}
