import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseProgrammeParams, programmeOrderBy, programmeWhere } from "@/lib/catalogue/params";
import { buildProgrammeCards } from "@/lib/cards/programme-cards";
import { getApplicantGroup } from "@/lib/deadlines/viewer-group";
import { TARGET_COUNTRIES } from "@/lib/constants/countries";
import { countryName } from "@/lib/ui/country";
import { formatCount, plural } from "@/lib/ui/format";
import { CatalogueHeader, EmptyResults, ExploreSwitcher, ViewToggle } from "@/components/kick/browse/layout";
import { ClearAll, FilterChip, QualifyChip, SearchBox, SortSelect } from "@/components/kick/browse/controls";
import { ProgrammeRow } from "@/components/kick/browse/rows";
import { MatchPosterCard } from "@/components/kick/match-poster-card";
import { Pagination } from "@/components/ui/pagination";

/** Divisible by 2, 3 and 4 columns, so the last row is never ragged. */
const PAGE_SIZE = 24;

const DEGREES = [
  { value: "BACHELOR", label: "Bachelor's" },
  { value: "MASTER", label: "Master's" },
  { value: "PHD", label: "PhD" },
];
const FIELDS = [
  { value: "STEM", label: "STEM" },
  { value: "BUSINESS", label: "Business" },
  { value: "HUMANITIES", label: "Humanities" },
  { value: "SOCIAL_SCIENCES", label: "Social sciences" },
  { value: "ARTS", label: "Arts" },
  { value: "HEALTH", label: "Health" },
  { value: "LAW", label: "Law" },
  { value: "EDUCATION", label: "Education" },
];
const TUITION = [
  { value: "FREE", label: "No tuition fees" },
  { value: "PAID", label: "Paid" },
];
const SORTS = [
  { value: "match", label: "Best match" },
  { value: "name", label: "Name (A–Z)" },
  { value: "tuition", label: "Tuition (low to high)" },
];

export async function generateMetadata({ searchParams }: PageProps<"/programs">): Promise<Metadata> {
  const q = (await searchParams).q;
  return { title: typeof q === "string" && q ? `Search: ${q} in Programmes` : "Programmes" };
}

export default async function ProgrammesPage({ searchParams }: PageProps<"/programs">) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = session.user.id;
  const now = new Date();

  const params = await searchParams;
  const f = parseProgrammeParams(params);

  const [matches, saved, tracked, profile] = await Promise.all([
    prisma.match.findMany({
      where: { userId, matchType: "PROGRAM" },
      select: { programId: true, score: true, matchStrength: true, factorScores: true },
    }),
    prisma.savedOpportunity.findMany({ where: { userId, opportunityType: "PROGRAM" }, select: { programId: true } }),
    prisma.application.findMany({ where: { userId, programId: { not: null } }, select: { programId: true } }),
    prisma.studentProfile.findUnique({
      where: { userId },
      select: { currentGpa: true, languageProficiencies: { select: { testName: true, score: true } } },
    }),
  ]);

  const qualifyIds = f.qualify
    ? matches.filter((m) => m.matchStrength !== "MISSING_REQUIREMENT" && m.programId).map((m) => m.programId!)
    : undefined;
  const where = programmeWhere(f, { onlyIds: qualifyIds });

  // The catalogue is 12,000+ programmes; one page at a time.
  const [total, unfilteredByQualify] = await Promise.all([
    prisma.program.count({ where }),
    f.qualify ? prisma.program.count({ where: programmeWhere(f) }) : Promise.resolve(0),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(f.page, totalPages);
  const skip = (page - 1) * PAGE_SIZE;

  let pageIds: string[];
  if (f.sort === "match") {
    // Scores live in a per-user table, so the database can't order by them.
    // Order the filtered ids first, then hydrate only the chosen page.
    const ids = await prisma.program.findMany({ where, select: { id: true } });
    const scoreById = new Map(matches.map((m) => [m.programId, m.score]));
    pageIds = ids
      .map((r) => r.id)
      .sort((a, b) => (scoreById.get(b) ?? -1) - (scoreById.get(a) ?? -1))
      .slice(skip, skip + PAGE_SIZE);
  } else {
    const rows = await prisma.program.findMany({ where, orderBy: programmeOrderBy(f.sort), skip, take: PAGE_SIZE, select: { id: true } });
    pageIds = rows.map((r) => r.id);
  }

  const cards = await buildProgrammeCards(pageIds, {
    matches: new Map(matches.map((m) => [m.programId!, m])),
    saved: new Set(saved.map((s) => s.programId!)),
    profile: profile ?? null,
    now,
    applicantGroup: await getApplicantGroup(userId),
  });
  const trackedSet = new Set(tracked.map((t) => t.programId));

  const rangeStart = total === 0 ? 0 : skip + 1;
  const rangeEnd = skip + cards.length;
  const summary =
    total === 0
      ? "0 programmes found"
      : f.qualify
        ? `${formatCount(total)} match your profile, out of ${formatCount(unfilteredByQualify)}`
        : `Showing ${formatCount(rangeStart)}–${formatCount(rangeEnd)} of ${plural(total, "programme")}`;

  const countries = Object.keys(TARGET_COUNTRIES)
    .map((code) => ({ value: code, label: countryName(code) }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <div className="pb-16">
      <ExploreSwitcher current="/programs" />
      <CatalogueHeader title="Programmes" summary={summary} />

      <div className="mt-5 space-y-3 px-gutter">
        <div className="max-w-[720px]">
          <SearchBox label="Search programmes or universities" placeholder="Search programmes or universities" resultLabel={plural(total, "result")} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip paramKey="country" label="Country" options={countries} />
          <FilterChip paramKey="degree" label="Degree" options={DEGREES} />
          <FilterChip paramKey="field" label="Field" options={FIELDS} />
          <FilterChip paramKey="tuition" label="Tuition" options={TUITION} />
          {profile && <QualifyChip />}
          <ClearAll keys={["q", "country", "degree", "field", "tuition", "qualify"]} />
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <SortSelect options={SORTS} fallback="match" />
            <ViewToggle params={params} pathname="/programs" />
          </div>
        </div>
      </div>

      <div className="mt-6">
        {cards.length === 0 ? (
          <EmptyResults message="No programmes match your filters yet." clearHref="/programs" />
        ) : f.view === "list" ? (
          <ul role="list" className="box-content flex max-w-[1328px] flex-col gap-3 px-gutter">
            {cards.map((c) => (
              <li key={c.id}>
                <ProgrammeRow card={c} now={now} />
              </li>
            ))}
          </ul>
        ) : (
          <ul role="list" className="box-content grid max-w-[1328px] gap-5 px-gutter [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]">
            {cards.map((c) => (
              <li key={c.id}>
                <MatchPosterCard card={c} mode="grid" tracking={trackedSet.has(c.id)} now={now} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-10 px-gutter">
        <Pagination basePath="/programs" params={params} page={page} totalPages={totalPages} />
      </div>
    </div>
  );
}
