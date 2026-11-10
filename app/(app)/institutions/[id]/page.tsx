import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { CalendarDays, ExternalLink } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getDataSaver } from "@/lib/ui/data-saver";
import { countryName } from "@/lib/ui/country";
import { formatCount, formatDuration } from "@/lib/ui/format";
import { degreeLabel } from "@/lib/ui/requirements";
import { institutionFaceSelect, toInstitutionFace } from "@/lib/cards/faces";
import { buildProgrammeCards } from "@/lib/cards/programme-cards";
import { buildScholarshipCards } from "@/lib/cards/scholarship-cards";
import { getComparisonProfile } from "@/lib/detail/shared";
import { DetailBanner } from "@/components/kick/detail/banner";
import { FactGrid, Panel, type Fact } from "@/components/kick/detail/panels";
import { CountryFlag } from "@/components/kick/country-flag";
import { Pill } from "@/components/kick/badges";
import { Rail } from "@/components/kick/rail";
import { MatchPosterCard } from "@/components/kick/match-poster-card";
import { FundingPoster } from "@/components/kick/funding-poster";

/** Enough to show the shape of the answer without an endless wall of rows. */
const LIST_LIMIT = 40;

const FIELD_LABEL: Record<string, string> = {
  STEM: "STEM",
  BUSINESS: "Business",
  HUMANITIES: "Humanities",
  SOCIAL_SCIENCES: "Social sciences",
  ARTS: "Arts",
  HEALTH: "Health",
  LAW: "Law",
  EDUCATION: "Education",
  OTHER: "Other",
};

const getUniversity = cache(async (id: string) =>
  prisma.university.findUnique({
    where: { id },
    select: {
      ...institutionFaceSelect,
      type: true,
      foundedYear: true,
      website: true,
      rorId: true,
      programs: {
        orderBy: { name: "asc" },
        take: LIST_LIMIT,
        select: { id: true, name: true, degreeLevel: true, fieldCategory: true, durationMonths: true },
      },
      fundingOpportunities: {
        // Source-stated links first, then the most confident inferences.
        orderBy: [{ linkMethod: "asc" }, { confidence: "desc" }],
        take: LIST_LIMIT,
        select: { linkMethod: true, scholarshipId: true },
      },
      _count: { select: { programs: true, fundingOpportunities: true } },
    },
  }),
);

export async function generateMetadata({ params }: PageProps<"/institutions/[id]">): Promise<Metadata> {
  // Metadata renders alongside the page, so it checks the session itself.
  if (!(await auth())?.user) return { title: "University" };
  const { id } = await params;
  const u = await getUniversity(id);
  return { title: u ? u.name : "University not found" };
}

export default async function UniversityPage({ params, searchParams }: PageProps<"/institutions/[id]">) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = session.user.id;
  const { id } = await params;
  const query = await searchParams;
  const now = new Date();

  const university = await getUniversity(id);
  if (!university) notFound();

  const face = toInstitutionFace(university);
  const [profile, dataSaver, matches, saved, tracked] = await Promise.all([
    getComparisonProfile(userId),
    getDataSaver(),
    prisma.match.findMany({
      where: { userId, matchType: "PROGRAM", program: { universityId: id } },
      orderBy: { score: "desc" },
      take: 20,
      select: { programId: true, score: true, matchStrength: true, factorScores: true },
    }),
    prisma.savedOpportunity.findMany({ where: { userId }, select: { programId: true, scholarshipId: true } }),
    prisma.application.findMany({ where: { userId, programId: { not: null } }, select: { programId: true } }),
  ]);

  const savedProgrammes = new Set(saved.flatMap((s) => (s.programId ? [s.programId] : [])));
  const savedScholarships = new Set(saved.flatMap((s) => (s.scholarshipId ? [s.scholarshipId] : [])));
  const trackedSet = new Set(tracked.map((t) => t.programId));
  const matchedIds = matches.flatMap((m) => (m.programId ? [m.programId] : []));
  const [matchCards, scholarshipCards] = await Promise.all([
    profile && matchedIds.length > 0
      ? buildProgrammeCards(matchedIds, {
          matches: new Map(matches.map((m) => [m.programId!, m])),
          saved: savedProgrammes,
          profile: { currentGpa: profile.currentGpa, languageProficiencies: profile.languageProficiencies },
          now,
        })
      : Promise.resolve([]),
    buildScholarshipCards([...new Set(university.fundingOpportunities.map((f) => f.scholarshipId))], {
      matches: new Map(),
      saved: savedScholarships,
      now,
    }),
  ]);
  const cardById = new Map(scholarshipCards.map((c) => [c.id, c]));
  const explicit = [...new Set(university.fundingOpportunities.filter((f) => f.linkMethod === "EXPLICIT_SOURCE").map((f) => f.scholarshipId))].flatMap((i) => cardById.get(i) ?? []);
  const inferred = [...new Set(university.fundingOpportunities.filter((f) => f.linkMethod === "RULE_INFERENCE").map((f) => f.scholarshipId))].flatMap((i) => cardById.get(i) ?? []);

  const facts: Fact[] = [
    { label: "Programmes", value: formatCount(university._count.programs) },
    { label: "Linked scholarships", value: formatCount(university._count.fundingOpportunities) },
  ];
  const place = [university.city, countryName(university.country)].filter(Boolean).join(", ");

  return (
    <div className="pb-16">
      <DetailBanner
        face={face}
        institutionLink={false}
        subtitle={
          <div className="flex flex-col gap-1.5 text-[15px] text-on-night-muted">
            <span className="flex items-center gap-2 font-bold text-white">
              <CountryFlag code={university.country} tone="night" />
              {place}
            </span>
            {university.foundedYear && (
              <span className="flex items-center gap-2">
                <CalendarDays aria-hidden="true" className="size-4" />
                Founded {university.foundedYear}
              </span>
            )}
          </div>
        }
        crumbs={[
          { label: "Universities", href: "/institutions" },
          { label: countryName(university.country), href: `/institutions?country=${encodeURIComponent(university.country)}` },
          { label: university.name },
        ]}
        title={university.name}
        pills={university.type ? <Pill tone="night">{university.type === "PUBLIC" ? "Public university" : "Private university"}</Pill> : null}
        aside={
          university.website ? (
            <a
              href={university.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center gap-2 rounded-full border border-white/45 px-6 text-base font-bold text-white hover:bg-white/10"
            >
              Website <ExternalLink aria-hidden="true" className="size-[18px]" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          ) : null
        }
        dataSaver={dataSaver}
        showPhoto={query.photo === "1"}
        photoHref={`/institutions/${id}?photo=1`}
      />

      <div className="box-content max-w-[1328px] px-gutter">
        <div className="mt-6 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
          <FactGrid facts={facts} className="contents" />
          {university.rorId && (
            <div className="rounded-tile bg-white px-4 py-3.5 shadow-hairline">
              <p className="text-[13px] text-ink-3">ROR identifier</p>
              <a
                href={`https://ror.org/${university.rorId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1.5 font-mono text-lg font-bold text-kick-blue hover:underline"
              >
                {university.rorId} <ExternalLink aria-hidden="true" className="size-4" />
                <span className="sr-only">(opens ror.org in a new tab)</span>
              </a>
            </div>
          )}
        </div>
      </div>

      {matchCards.length > 0 && (
        <div className="mt-12">
          <Rail id="matched" title="Programmes you match here" prevLabel="Previous programmes" nextLabel="More programmes">
            {matchCards.map((c) => (
              <MatchPosterCard key={c.id} card={c} tracking={trackedSet.has(c.id)} now={now} />
            ))}
          </Rail>
        </div>
      )}

      <div className="box-content mt-12 flex max-w-[1328px] flex-col gap-6 px-gutter">
        <Panel id="programmes" title="All programmes">
          {university.programs.length === 0 ? (
            <p className="text-[15px] text-ink-3">
              No programmes recorded for this institution yet. Its scholarships still apply at the institution level.
            </p>
          ) : (
            <>
              <ul role="list" className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                {university.programs.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/programs/${p.id}`}
                      className="flex min-h-[64px] items-center justify-between gap-3 rounded-tile bg-paper px-4 py-3 transition-shadow hover:shadow-preview"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[15px] font-bold text-ink">{p.name}</span>
                        <span className="block text-sm text-ink-3">
                          {FIELD_LABEL[p.fieldCategory] ?? p.fieldCategory}
                          {formatDuration(p.durationMonths) ? ` · ${formatDuration(p.durationMonths)}` : ""}
                        </span>
                      </span>
                      {degreeLabel(p.degreeLevel) && <Pill>{degreeLabel(p.degreeLevel)}</Pill>}
                    </Link>
                  </li>
                ))}
              </ul>
              {university._count.programs > LIST_LIMIT && (
                <p className="mt-3 text-sm text-ink-3">
                  and {formatCount(university._count.programs - LIST_LIMIT)} more.{" "}
                  <Link href={`/programs?q=${encodeURIComponent(university.name)}`} className="font-bold text-kick-blue hover:underline">
                    Search them all
                  </Link>
                </p>
              )}
            </>
          )}
        </Panel>

        <Panel id="scholarships" title="Scholarships">
          {explicit.length + inferred.length === 0 ? (
            <p className="text-[15px] text-ink-3">No scholarships linked to this institution yet.</p>
          ) : (
            <div className="space-y-8">
              {[
                { title: "Officially linked", note: "Named directly by the scholarship provider.", cards: explicit },
                {
                  title: "May apply here",
                  note: "Matched from each scholarship's own stated rules, not confirmed by the provider. Check before applying.",
                  cards: inferred,
                },
              ]
                .filter((g) => g.cards.length > 0)
                .map((g) => (
                  <div key={g.title}>
                    <h3 className="text-base font-bold text-ink">{g.title}</h3>
                    <p className="mt-0.5 mb-4 text-sm text-ink-3">{g.note}</p>
                    <ul role="list" className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]">
                      {g.cards.map((c) => (
                        <li key={c.id}>
                          <FundingPoster card={c} mode="compact" now={now} />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              {university._count.fundingOpportunities > LIST_LIMIT && (
                <p className="text-sm text-ink-3">
                  and {formatCount(university._count.fundingOpportunities - LIST_LIMIT)} more matching the same rules
                </p>
              )}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
