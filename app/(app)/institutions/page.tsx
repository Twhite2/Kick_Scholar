import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseUniversityParams, universityOrderBy, universityWhere } from "@/lib/catalogue/params";
import { institutionFaceSelect, toInstitutionFace } from "@/lib/cards/faces";
import { countryName } from "@/lib/ui/country";
import { formatCount, plural } from "@/lib/ui/format";
import { CatalogueHeader, EmptyResults, ExploreSwitcher } from "@/components/kick/browse/layout";
import { ClearAll, FilterChip, SearchBox, SortSelect } from "@/components/kick/browse/controls";
import { UniversityCard } from "@/components/kick/browse/rows";
import { Pagination } from "@/components/ui/pagination";

const PAGE_SIZE = 24;

const SHOW = [
  { value: "scholarships", label: "With scholarships" },
  { value: "programs", label: "With programmes" },
];
const SORTS = [
  { value: "scholarships", label: "Most scholarships" },
  { value: "programs", label: "Most programmes" },
  { value: "name", label: "Name (A–Z)" },
];

export async function generateMetadata({ searchParams }: PageProps<"/institutions">): Promise<Metadata> {
  const q = (await searchParams).q;
  return { title: typeof q === "string" && q ? `Search: ${q} in Universities` : "Universities" };
}

export default async function UniversitiesPage({ searchParams }: PageProps<"/institutions">) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const params = await searchParams;
  const f = parseUniversityParams(params);
  const where = universityWhere(f);

  // Thousands of institutions: paginated from the start.
  const total = await prisma.university.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(f.page, totalPages);
  const skip = (page - 1) * PAGE_SIZE;

  const [countryRows, universities] = await Promise.all([
    prisma.university.groupBy({ by: ["country"], _count: { country: true }, orderBy: { _count: { country: "desc" } } }),
    prisma.university.findMany({
      where,
      // Counting relations in SQL keeps this to one query for the page.
      select: { ...institutionFaceSelect, type: true, _count: { select: { programs: true, fundingOpportunities: true } } },
      orderBy: universityOrderBy(f.sort),
      skip,
      take: PAGE_SIZE,
    }),
  ]);

  // Countries come from the data, with counts: a fixed list would hide some.
  const countries = countryRows.map((r) => ({
    value: r.country,
    label: `${countryName(r.country)} (${formatCount(r._count.country)})`,
  }));

  const rangeStart = total === 0 ? 0 : skip + 1;
  const rangeEnd = skip + universities.length;
  const summary = total === 0 ? "0 universities found" : `Showing ${formatCount(rangeStart)}–${formatCount(rangeEnd)} of ${plural(total, "university", "universities")}`;

  return (
    <div className="pb-16">
      <ExploreSwitcher current="/institutions" />
      <CatalogueHeader title="Universities" summary={summary} />

      <div className="mt-5 space-y-3 px-gutter">
        <div className="max-w-[720px]">
          <SearchBox label="Search universities or cities" placeholder="Search universities or cities" resultLabel={plural(total, "result")} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip paramKey="country" label="Country" options={countries} />
          <FilterChip paramKey="has" label="Show" options={SHOW} />
          <ClearAll keys={["q", "country", "has"]} />
          <div className="ml-auto">
            <SortSelect options={SORTS} fallback="scholarships" />
          </div>
        </div>
      </div>

      <div className="mt-6">
        {universities.length === 0 ? (
          <EmptyResults message="No universities match your filters yet." clearHref="/institutions" />
        ) : (
          <ul role="list" className="box-content grid max-w-[1328px] gap-4 px-gutter [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]">
            {universities.map((u) => (
              <li key={u.id}>
                <UniversityCard
                  u={{ face: toInstitutionFace(u), type: u.type, programCount: u._count.programs, fundingCount: u._count.fundingOpportunities }}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-10 px-gutter">
        <Pagination basePath="/institutions" params={params} page={page} totalPages={totalPages} />
      </div>
    </div>
  );
}
