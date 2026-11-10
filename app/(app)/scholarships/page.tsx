import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseScholarshipParams, scholarshipWhere } from "@/lib/catalogue/params";
import { buildScholarshipCards } from "@/lib/cards/scholarship-cards";
import { TARGET_COUNTRIES } from "@/lib/constants/countries";
import { countryName } from "@/lib/ui/country";
import { COVERAGE_LABEL } from "@/lib/ui/coverage";
import { formatCount, plural } from "@/lib/ui/format";
import { CatalogueHeader, EmptyResults, ExploreSwitcher, ViewToggle } from "@/components/kick/browse/layout";
import { ClearAll, FilterChip, QualifyChip, SearchBox } from "@/components/kick/browse/controls";
import { ScholarshipRow } from "@/components/kick/browse/rows";
import { FundingPoster } from "@/components/kick/funding-poster";
import { Pagination } from "@/components/ui/pagination";

const PAGE_SIZE = 24;

const COVERAGES = (["FULL_FUNDING", "FULL_TUITION", "PARTIAL_TUITION", "STIPEND", "TRAVEL"] as const).map((c) => ({
  value: c,
  label: COVERAGE_LABEL[c],
}));
const VERIFICATION = [{ value: "true", label: "Verified sources only" }];

export async function generateMetadata({ searchParams }: PageProps<"/scholarships">): Promise<Metadata> {
  const q = (await searchParams).q;
  return { title: typeof q === "string" && q ? `Search: ${q} in Scholarships` : "Scholarships" };
}

export default async function ScholarshipsPage({ searchParams }: PageProps<"/scholarships">) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = session.user.id;
  const now = new Date();

  const params = await searchParams;
  const f = parseScholarshipParams(params);

  const [matches, saved, hasProfile] = await Promise.all([
    prisma.match.findMany({
      where: { userId, matchType: "SCHOLARSHIP" },
      select: { scholarshipId: true, score: true, matchStrength: true, factorScores: true },
    }),
    prisma.savedOpportunity.findMany({ where: { userId, opportunityType: "SCHOLARSHIP" }, select: { scholarshipId: true } }),
    prisma.studentProfile.count({ where: { userId } }),
  ]);

  const qualifyIds = f.qualify
    ? matches.filter((m) => m.matchStrength !== "MISSING_REQUIREMENT" && m.scholarshipId).map((m) => m.scholarshipId!)
    : undefined;
  const where = scholarshipWhere(f, { onlyIds: qualifyIds });

  const [total, unfilteredByQualify] = await Promise.all([
    prisma.scholarship.count({ where }),
    f.qualify ? prisma.scholarship.count({ where: scholarshipWhere(f) }) : Promise.resolve(0),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(f.page, totalPages);
  const skip = (page - 1) * PAGE_SIZE;

  // Best match first, as before: order the filtered ids by the student's
  // score, then hydrate only this page.
  const ids = await prisma.scholarship.findMany({ where, select: { id: true } });
  const scoreById = new Map(matches.map((m) => [m.scholarshipId, m.score]));
  const pageIds = ids
    .map((r) => r.id)
    .sort((a, b) => (scoreById.get(b) ?? -1) - (scoreById.get(a) ?? -1))
    .slice(skip, skip + PAGE_SIZE);

  const cards = await buildScholarshipCards(pageIds, {
    matches: new Map(matches.map((m) => [m.scholarshipId!, m])),
    saved: new Set(saved.map((s) => s.scholarshipId!)),
    now,
  });

  const rangeStart = total === 0 ? 0 : skip + 1;
  const rangeEnd = skip + cards.length;
  const summary =
    total === 0
      ? "0 scholarships found"
      : f.qualify
        ? `${formatCount(total)} match your profile, out of ${formatCount(unfilteredByQualify)}`
        : `Showing ${formatCount(rangeStart)}–${formatCount(rangeEnd)} of ${plural(total, "scholarship")}`;

  const countries = Object.keys(TARGET_COUNTRIES)
    .map((code) => ({ value: code, label: countryName(code) }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <div className="pb-16">
      <ExploreSwitcher current="/scholarships" />
      <CatalogueHeader title="Scholarships" summary={summary} />

      <div className="mt-5 space-y-3 px-gutter">
        <div className="max-w-[720px]">
          <SearchBox label="Search scholarships or providers" placeholder="Search scholarships or providers" resultLabel={plural(total, "result")} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip paramKey="country" label="Country" options={countries} />
          <FilterChip paramKey="coverage" label="Coverage" options={COVERAGES} />
          <FilterChip paramKey="verified" label="Source" options={VERIFICATION} />
          {hasProfile > 0 && <QualifyChip />}
          <ClearAll keys={["q", "country", "coverage", "verified", "qualify"]} />
          <div className="ml-auto">
            <ViewToggle params={params} pathname="/scholarships" />
          </div>
        </div>
      </div>

      <div className="mt-6">
        {cards.length === 0 ? (
          <EmptyResults message="No scholarships match your filters yet." clearHref="/scholarships" />
        ) : f.view === "list" ? (
          <ul role="list" className="box-content flex max-w-[1328px] flex-col gap-3 px-gutter">
            {cards.map((c) => (
              <li key={c.id}>
                <ScholarshipRow card={c} now={now} />
              </li>
            ))}
          </ul>
        ) : (
          <ul role="list" className="box-content grid max-w-[1328px] gap-5 px-gutter [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]">
            {cards.map((c) => (
              <li key={c.id}>
                <FundingPoster card={c} mode="grid" now={now} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-10 px-gutter">
        <Pagination basePath="/scholarships" params={params} page={page} totalPages={totalPages} />
      </div>
    </div>
  );
}
