import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { InstitutionCard, type InstitutionCardData } from "@/components/institutions/institution-card";
import {
  InstitutionFilterPanel,
  type CountryOption,
} from "@/components/institutions/institution-filter-panel";
import { Pagination } from "@/components/ui/pagination";
import { COUNTRY_LABELS } from "@/lib/constants/countryNames";
import type { Prisma } from "@/lib/generated/prisma/client";

/** Divisible by both grid widths (2 and 3 columns), so no ragged last row. */
const PAGE_SIZE = 24;

export default async function InstitutionsPage({ searchParams }: PageProps<"/institutions">) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : undefined;
  const country = typeof params.country === "string" ? params.country : undefined;
  const has = typeof params.has === "string" ? params.has : undefined;
  const sort = typeof params.sort === "string" ? params.sort : "scholarships";
  const requestedPage = Number(typeof params.page === "string" ? params.page : "1");
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.floor(requestedPage) : 1;

  const where: Prisma.UniversityWhereInput = {
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { city: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(country ? { country } : {}),
    ...(has === "programs" ? { programs: { some: {} } } : {}),
    ...(has === "scholarships" ? { fundingOpportunities: { some: {} } } : {}),
  };

  // The catalogue holds thousands of institutions, so this is paginated from
  // the start rather than after a browser gives up rendering it.
  const total = await prisma.university.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const skip = (currentPage - 1) * PAGE_SIZE;

  const [countryRows, universities] = await Promise.all([
    prisma.university.groupBy({
      by: ["country"],
      _count: { country: true },
      orderBy: { _count: { country: "desc" } },
    }),
    prisma.university.findMany({
      where,
      // Counting relations in SQL keeps this to one query rather than one per
      // row, which matters at 24 cards a page.
      include: { _count: { select: { programs: true, fundingOpportunities: true } } },
      orderBy:
        sort === "name"
          ? { name: "asc" }
          : sort === "programs"
            ? { programs: { _count: "desc" } }
            : { fundingOpportunities: { _count: "desc" } },
      skip,
      take: PAGE_SIZE,
    }),
  ]);

  const countries: CountryOption[] = countryRows.map((row) => ({
    code: row.country,
    label: COUNTRY_LABELS[row.country] ?? row.country,
    count: row._count.country,
  }));

  const cards: InstitutionCardData[] = universities.map((u) => ({
    id: u.id,
    name: u.name,
    country: u.country,
    city: u.city,
    type: u.type,
    programCount: u._count.programs,
    fundingCount: u._count.fundingOpportunities,
    verified: u.verified,
  }));

  const rangeStart = total === 0 ? 0 : skip + 1;
  const rangeEnd = skip + cards.length;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 md:px-8 md:py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Institutions</h1>
        <p className="mt-1 text-muted-foreground">
          {total === 0
            ? "0 institutions found"
            : `Showing ${rangeStart}–${rangeEnd} of ${total.toLocaleString()} institutions`}
        </p>
      </div>

      <InstitutionFilterPanel countries={countries} />

      {cards.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
          No institutions match your filters yet.
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((institution) => (
              <InstitutionCard key={institution.id} institution={institution} />
            ))}
          </div>
          <Pagination
            basePath="/institutions"
            params={params}
            page={currentPage}
            totalPages={totalPages}
          />
        </>
      )}
    </div>
  );
}
