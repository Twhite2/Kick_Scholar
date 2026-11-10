import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { FactorScore } from "@/lib/matching/types";
import { getDataSaver } from "@/lib/ui/data-saver";
import { closesIn, daysUntil, formatDate, formatDuration, formatMoney, isUrgent } from "@/lib/ui/format";
import { countryName } from "@/lib/ui/country";
import { blockersOf } from "@/lib/ui/blockers";
import { deriveNextSteps } from "@/lib/ui/next-steps";
import { basisLine } from "@/lib/ui/reasons";
import { actionHref, cleanSourceText, degreeLabel, programmeRows, requirementTypeLabel } from "@/lib/ui/requirements";
import { institutionFaceSelect, toInstitutionFace } from "@/lib/cards/faces";
import { buildProgrammeCards, matchInfo, officialFundingFor, tuitionOf } from "@/lib/cards/programme-cards";
import { buildScholarshipCards } from "@/lib/cards/scholarship-cards";
import { DEADLINE_LABEL, capitalise, getComparisonProfile, joinList, splitLanguages, usefulDeadlineText } from "@/lib/detail/shared";
import { BannerScoreCard, DetailBanner } from "@/components/kick/detail/banner";
import { AdviceLists, FactGrid, KeyDates, Panel, ProvenanceCard, RequirementComparison, ScoreBreakdown, type Fact, type KeyDate } from "@/components/kick/detail/panels";
import { Pill, RequirementBadge, SourceBadge } from "@/components/kick/badges";
import { TrackButton } from "@/components/kick/track-button";
import { SaveButton } from "@/components/kick/save-button";
import { CompareButton } from "@/components/kick/compare-tray";
import { ShareButton } from "@/components/kick/share-button";
import { NextSteps } from "@/components/kick/next-steps";
import { FundingPoster } from "@/components/kick/funding-poster";
import { ExpandableGrid } from "@/components/kick/expandable-grid";
import { Rail } from "@/components/kick/rail";
import { MatchPosterCard } from "@/components/kick/match-poster-card";

/** Kept from the old Funding tab: never show more than this per group. */
const FUNDING_CAP = 40;

const getProgramme = cache(async (id: string) =>
  prisma.program.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      degreeLevel: true,
      fieldOfStudy: true,
      fieldCategory: true,
      durationMonths: true,
      instructionLanguages: true,
      tuitionType: true,
      tuitionAmount: true,
      tuitionCurrency: true,
      tuitionPeriod: true,
      intakes: true,
      programUrl: true,
      description: true,
      verified: true,
      sourceUrl: true,
      lastVerifiedAt: true,
      universityId: true,
      university: { select: { ...institutionFaceSelect, type: true } },
      primarySource: { select: { name: true, lastSuccessfulCrawlAt: true } },
      requirements: {
        select: { id: true, requirementType: true, testName: true, operator: true, value: true, unit: true, description: true, verified: true },
      },
      deadlines: { select: { id: true, deadlineType: true, date: true, dateText: true, intake: true }, orderBy: { date: "asc" } },
      fundingOpportunities: {
        orderBy: [{ linkMethod: "asc" }, { confidence: "desc" }],
        take: FUNDING_CAP,
        select: { linkMethod: true, scholarshipId: true },
      },
    },
  }),
);

export async function generateMetadata({ params }: PageProps<"/programs/[id]">): Promise<Metadata> {
  // Metadata renders alongside the page, so it checks the session itself.
  if (!(await auth())?.user) return { title: "Programme" };
  const { id } = await params;
  const p = await getProgramme(id);
  return { title: p ? `${p.name} at ${p.university.name}` : "Programme not found" };
}

export default async function ProgrammePage({ params, searchParams }: PageProps<"/programs/[id]">) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = session.user.id;
  const { id } = await params;
  const query = await searchParams;
  const now = new Date();

  const program = await getProgramme(id);
  if (!program) notFound();

  const [match, saved, application, profile, universityFunding, dataSaver, savedScholarships] = await Promise.all([
    prisma.match.findFirst({
      where: { userId, programId: id },
      select: { score: true, matchStrength: true, factorScores: true, missingRequirements: true, recommendedActions: true },
    }),
    prisma.savedOpportunity.findFirst({ where: { userId, programId: id }, select: { id: true } }),
    prisma.application.findFirst({
      where: { userId, programId: id },
      select: { id: true, documents: { select: { id: true, name: true, completed: true }, orderBy: { id: "asc" } } },
    }),
    getComparisonProfile(userId),
    // A scholarship whose rules bind only by country is linked to the whole
    // university (programId null), so the programme's own links never see it.
    prisma.fundingOpportunity.findMany({
      where: { universityId: program.universityId, programId: null },
      orderBy: [{ linkMethod: "asc" }, { confidence: "desc" }],
      take: FUNDING_CAP,
      select: { scholarshipId: true },
    }),
    getDataSaver(),
    prisma.savedOpportunity.findMany({ where: { userId, scholarshipId: { not: null } }, select: { scholarshipId: true } }),
  ]);

  const face = toInstitutionFace(program.university);
  const factors = (match?.factorScores as unknown as FactorScore[] | undefined) ?? [];
  const info = matchInfo(match ?? undefined, program.verified);
  const tuition = tuitionOf(program);
  const linked = (await officialFundingFor([program])).get(program.id) ?? [];
  const languages = splitLanguages(program.instructionLanguages);
  const nextDated = program.deadlines.find((d) => d.date && daysUntil(d.date, now) >= 0) ?? null;

  // --- Funding groups -------------------------------------------------------
  const explicitIds = program.fundingOpportunities.filter((f) => f.linkMethod === "EXPLICIT_SOURCE").map((f) => f.scholarshipId);
  const inferredIds = program.fundingOpportunities.filter((f) => f.linkMethod === "RULE_INFERENCE").map((f) => f.scholarshipId);
  const uniIds = [...new Set(universityFunding.map((f) => f.scholarshipId))].filter((s) => !explicitIds.includes(s) && !inferredIds.includes(s));
  const savedSet = new Set(savedScholarships.map((s) => s.scholarshipId!));
  const fundingCards = await buildScholarshipCards([...new Set([...explicitIds, ...inferredIds, ...uniIds])], {
    matches: new Map(),
    saved: savedSet,
    now,
  });
  const cardById = new Map(fundingCards.map((c) => [c.id, c]));
  const group = (ids: string[]) => ids.flatMap((i) => cardById.get(i) ?? []);
  const fundingGroups = [
    { title: "Officially linked", note: "Named directly by the scholarship provider.", cards: group(explicitIds) },
    {
      title: "May apply here",
      note: "Matched from each scholarship's own stated rules — not confirmed by the provider. Check before applying.",
      cards: group(inferredIds),
    },
    {
      title: `Open across ${program.university.name}`,
      note: "Bound to the institution rather than this specific programme — the scholarship's rules name a country, not a subject or degree level.",
      cards: group(uniIds),
    },
  ].filter((g) => g.cards.length > 0);

  // --- Facts ----------------------------------------------------------------
  const coversTuition = linked.some((l) => l.coverage === "FULL_TUITION" || l.coverage === "FULL_FUNDING" || l.coverage === "PARTIAL_TUITION");
  const facts: Fact[] = [];
  facts.push({
    label: "Tuition",
    value:
      tuition.kind === "free"
        ? "Free"
        : tuition.kind === "amount"
          ? formatMoney(tuition.amount, tuition.currency)
          : tuition.kind === "varies"
            ? "Varies"
            : "Not yet published",
    note:
      tuition.kind === "amount" && coversTuition
        ? "A linked scholarship can cover it"
        : tuition.kind === "amount"
          ? tuition.per === "year"
            ? "a year"
            : tuition.per === "semester"
              ? "a semester"
              : tuition.per === "total"
                ? "in total"
                : null
          : tuition.kind === "free"
            ? "No tuition fees"
            : null,
    noteTone: (tuition.kind === "amount" && coversTuition) || tuition.kind === "free" ? "green" : "muted",
  });
  const duration = formatDuration(program.durationMonths);
  if (duration) facts.push({ label: "Length", value: duration });
  if (program.intakes.length > 0) facts.push({ label: "Starts", value: joinList(program.intakes.map(capitalise)) });
  if (nextDated?.date) {
    const days = daysUntil(nextDated.date, now);
    facts.push({ label: "Applications", value: `Close ${formatDate(nextDated.date, now)}`, note: closesIn(days), noteTone: isUrgent(days) ? "red" : "muted" });
  }
  if (languages.length > 0) facts.push({ label: "Taught in", value: joinList(languages) });

  // --- Why you match ----------------------------------------------------------
  const rows = programmeRows(program.requirements, factors, profile);
  const blockers = blockersOf(factors);
  const steps = deriveNextSteps({
    kind: "PROGRAM",
    blockers,
    requirements: program.requirements.map((r) => ({ type: r.requirementType, testName: r.testName })),
    deadline: nextDated?.date ?? null,
    now,
  });

  // --- Key dates ------------------------------------------------------------
  const keyDates = program.deadlines.flatMap((d): KeyDate[] => {
    const label = `${DEADLINE_LABEL[d.deadlineType] ?? "Deadline"}${d.intake ? ` (${d.intake})` : ""}`;
    if (d.date) return [{ label, date: d.date.toISOString() }];
    const text = usefulDeadlineText(d.dateText);
    return text ? [{ label, date: null, text }] : [];
  });

  // --- More like this ---------------------------------------------------------
  const similarMatches = await prisma.match.findMany({
    where: { userId, matchType: "PROGRAM", programId: { not: id }, program: { fieldCategory: program.fieldCategory, degreeLevel: program.degreeLevel } },
    orderBy: { score: "desc" },
    take: 12,
    select: { programId: true, score: true, matchStrength: true, factorScores: true },
  });
  let similarIds = similarMatches.flatMap((m) => (m.programId ? [m.programId] : []));
  if (similarIds.length === 0 && !profile) {
    const rows = await prisma.program.findMany({
      where: { id: { not: id }, fieldCategory: program.fieldCategory, degreeLevel: program.degreeLevel },
      orderBy: { name: "asc" },
      take: 12,
      select: { id: true },
    });
    similarIds = rows.map((r) => r.id);
  }
  let similarCards: Awaited<ReturnType<typeof buildProgrammeCards>> = [];
  let trackedSet = new Set<string>();
  if (similarIds.length >= 3) {
    const [savedRows, trackedRows] = await Promise.all([
      prisma.savedOpportunity.findMany({ where: { userId, programId: { in: similarIds } }, select: { programId: true } }),
      prisma.application.findMany({ where: { userId, programId: { in: similarIds } }, select: { programId: true } }),
    ]);
    similarCards = await buildProgrammeCards(similarIds, {
      matches: new Map(similarMatches.map((m) => [m.programId!, m])),
      saved: new Set(savedRows.flatMap((s) => (s.programId ? [s.programId] : []))),
      profile: profile ? { currentGpa: profile.currentGpa, languageProficiencies: profile.languageProficiencies } : null,
      now,
    });
    trackedSet = new Set(trackedRows.flatMap((a) => (a.programId ? [a.programId] : [])));
  }

  const country = program.university.country;
  const title = program.name;
  const pills = (
    <>
      <SourceBadge verified={program.verified} tone="night" />
      {languages.includes("English") && <Pill tone="night">Taught in English</Pill>}
      {duration && <Pill tone="night">{duration}</Pill>}
      {degreeLabel(program.degreeLevel) && <Pill tone="night">{degreeLabel(program.degreeLevel)}</Pill>}
    </>
  );

  return (
    <div className="pb-16">
      <DetailBanner
        face={face}
        crumbs={[
          { label: "Programmes", href: "/programs" },
          { label: countryName(country), href: `/programs?country=${encodeURIComponent(country)}` },
          { label: program.university.name, href: `/institutions/${program.university.id}` },
        ]}
        title={title}
        pills={pills}
        aside={<BannerScoreCard match={info} basis={basisLine(factors)} />}
        dataSaver={dataSaver}
        showPhoto={query.photo === "1"}
        photoHref={`/programs/${id}?photo=1`}
      />

      {/* Action bar */}
      <div className="border-b border-line bg-white px-gutter py-3.5">
        <div className="flex flex-wrap items-center gap-3">
          <TrackButton targetType="PROGRAM" targetId={id} title={title} initialTracking={Boolean(application)} refreshOnTrack />
          <a
            href={program.programUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 items-center gap-2 rounded-full border border-line-strong bg-white px-5 text-base font-bold text-ink hover:border-kick-blue hover:text-kick-blue"
          >
            Apply on the university site <ExternalLink aria-hidden="true" className="size-[18px]" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
          <div className="flex items-center gap-2 sm:ml-auto">
            <SaveButton targetType="program" targetId={id} title={title} initialSaved={Boolean(saved)} />
            <CompareButton item={{ id, title, institution: { id: face.id, name: face.name, logoUrl: face.logoUrl, acronym: face.acronym } }} />
            <ShareButton title={title} />
          </div>
        </div>
      </div>

      <div className="box-content max-w-[1328px] px-gutter">
        <FactGrid facts={facts} className="mt-6" />

        <div className="mt-6 flex flex-wrap items-start gap-6">
          <div className="flex min-w-0 max-w-[860px] flex-[999_1_560px] flex-col gap-6">
            <Panel id="why" title="Why you match" intro={match ? "Your profile, checked against the requirements on the university's admissions page." : undefined}>
              {match ? (
                <div className="space-y-8">
                  <RequirementComparison rows={rows} />
                  <div>
                    <h3 className="text-base font-bold text-ink">Score breakdown</h3>
                    <div className="mt-3">
                      <ScoreBreakdown factors={factors} />
                    </div>
                  </div>
                  <AdviceLists
                    blockers={match.missingRequirements}
                    actions={match.recommendedActions.map((a) => ({ text: a, href: actionHref(a) }))}
                  />
                </div>
              ) : (
                <p className="text-[15px] text-ink-3">
                  <Link href="/profile" className="font-bold text-kick-blue hover:underline">
                    Complete your profile
                  </Link>{" "}
                  to see why you match this programme.
                </p>
              )}
            </Panel>

            <Panel id="funding" title="Funding for this programme">
              {fundingGroups.length === 0 ? (
                <p className="text-[15px] text-ink-3">
                  No scholarships linked to this programme yet — check the Scholarships page for opportunities that may still apply.
                </p>
              ) : (
                <div className="space-y-8">
                  {fundingGroups.map((g) => (
                    <div key={g.title}>
                      <h3 className="text-base font-bold text-ink">{g.title}</h3>
                      <p className="mt-0.5 mb-4 text-sm text-ink-3">{g.note}</p>
                      <ExpandableGrid initial={12} noun="scholarships">
                        {g.cards.map((c) => (
                          <FundingPoster key={c.id} card={c} mode="compact" now={now} />
                        ))}
                      </ExpandableGrid>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel id="requirements" title="Entry requirements">
              {program.requirements.length === 0 ? (
                <p className="text-[15px] text-ink-3">No structured requirements published yet.</p>
              ) : (
                <ul role="list" className="divide-y divide-line">
                  {program.requirements.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-start justify-between gap-3 py-3.5 first:pt-0 last:pb-0">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-ink">
                          {requirementTypeLabel(r.requirementType)}
                          {r.testName ? `: ${r.testName}` : ""}
                        </p>
                        {r.description && <p className="mt-1 max-w-[70ch] text-[15px] text-ink-2">{cleanSourceText(r.description)}</p>}
                      </div>
                      <RequirementBadge verified={r.verified} />
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel id="overview" title="About this programme">
              <p className="max-w-[70ch] text-base leading-relaxed text-ink-2">
                {program.description ?? "No description available from the source yet."}
              </p>
              <dl className="mt-5 grid gap-4 text-[15px] sm:grid-cols-2">
                <div>
                  <dt className="text-[13px] text-ink-3">Field</dt>
                  <dd className="font-bold text-ink">{program.fieldOfStudy}</dd>
                </div>
                {program.intakes.length > 0 && (
                  <div>
                    <dt className="text-[13px] text-ink-3">Intakes</dt>
                    <dd className="font-bold text-ink">{joinList(program.intakes.map(capitalise))}</dd>
                  </div>
                )}
              </dl>
            </Panel>
          </div>

          <aside aria-label="Plan and sources" className="flex min-w-0 flex-[1_1_340px] flex-col gap-6">
            <NextSteps steps={steps} checklist={application?.documents ?? null} target={{ type: "PROGRAM", id, title }} />
            <KeyDates dates={keyDates} intakes={program.intakes.map(capitalise)} now={now} />
            <ProvenanceCard
              sourceName={program.primarySource.name}
              sourceUrl={program.sourceUrl}
              checkedAt={program.lastVerifiedAt ?? program.primarySource.lastSuccessfulCrawlAt}
              officialUrl={program.programUrl}
              subject={`${title} at ${program.university.name}`}
            />
          </aside>
        </div>
      </div>

      {similarCards.length >= 3 && (
        <div className="mt-12">
          <Rail id="similar" title="More like this" prevLabel="Previous programmes" nextLabel="More programmes">
            {similarCards.map((c) => (
              <MatchPosterCard key={c.id} card={c} tracking={trackedSet.has(c.id)} now={now} />
            ))}
          </Rail>
        </div>
      )}
    </div>
  );
}
