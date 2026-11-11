import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { Coins, ExternalLink, Info } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { FactorScore } from "@/lib/matching/types";
import { closesIn, daysUntil, formatDate, formatFullDate, isUrgent } from "@/lib/ui/format";
import { countryName } from "@/lib/ui/country";
import { COVERAGE_LABEL, POSTER_BAND_BG, isCoverage, posterAmount, posterBand } from "@/lib/ui/coverage";
import { blockersOf } from "@/lib/ui/blockers";
import { deriveNextSteps } from "@/lib/ui/next-steps";
import { basisLine } from "@/lib/ui/reasons";
import { actionHref, cleanSourceText, criterionLabel, degreeLabel, scholarshipRows } from "@/lib/ui/requirements";
import { institutionFaceSelect, providerFace, toInstitutionFace } from "@/lib/cards/faces";
import { matchInfo } from "@/lib/cards/programme-cards";
import { amountPer, buildScholarshipCards, providerInstitutions } from "@/lib/cards/scholarship-cards";
import { applicantGroupFor, deadlineAppliesTo, intakeLabel } from "@/lib/deadlines/applicant-group";
import { getComparisonProfile, joinList, usefulDeadlineText } from "@/lib/detail/shared";
import { BannerScoreCard, NightBreadcrumb } from "@/components/kick/detail/banner";
import { AdviceLists, FactGrid, KeyDates, Panel, ProvenanceCard, RequirementComparison, ScoreBreakdown, type Fact, type KeyDate } from "@/components/kick/detail/panels";
import { WhereUsed, type WhereRow } from "@/components/kick/detail/where-used";
import { Pill, RequirementBadge, SourceBadge } from "@/components/kick/badges";
import { InstitutionLogo } from "@/components/kick/institution-logo";
import { Rosette, FundingPoster } from "@/components/kick/funding-poster";
import { TrackButton } from "@/components/kick/track-button";
import { SaveButton } from "@/components/kick/save-button";
import { ShareButton } from "@/components/kick/share-button";
import { NextSteps } from "@/components/kick/next-steps";
import { Rail } from "@/components/kick/rail";

const LINK_PREVIEW = 8;

const getScholarship = cache(async (id: string) =>
  prisma.scholarship.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      providerName: true,
      country: true,
      amount: true,
      amountCurrency: true,
      amountPeriod: true,
      coverageType: true,
      description: true,
      applicationUrl: true,
      deadlineText: true,
      isRenewable: true,
      officialSourceUrl: true,
      sourceUrl: true,
      verified: true,
      lastVerifiedAt: true,
      primarySource: { select: { name: true, lastSuccessfulCrawlAt: true } },
      eligibility: {
        select: { id: true, criterionType: true, operator: true, valueList: true, numericValue: true, textValue: true, description: true, verified: true },
      },
      deadlines: { select: { id: true, deadlineType: true, date: true, dateText: true, intake: true }, orderBy: { date: "asc" } },
    },
  }),
);

export async function generateMetadata({ params }: PageProps<"/scholarships/[id]">): Promise<Metadata> {
  // Metadata renders alongside the page, so it checks the session itself.
  if (!(await auth())?.user) return { title: "Scholarship" };
  const { id } = await params;
  const s = await getScholarship(id);
  return { title: s ? s.name : "Scholarship not found" };
}

export default async function ScholarshipPage({ params }: PageProps<"/scholarships/[id]">) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = session.user.id;
  const { id } = await params;
  const now = new Date();

  const s = await getScholarship(id);
  if (!s) notFound();

  const linkSelect = {
    id: true,
    programId: true,
    inferenceBasis: true,
    program: { select: { id: true, name: true, university: { select: institutionFaceSelect } } },
    university: { select: institutionFaceSelect },
  } as const;

  const [match, saved, application, profile, explicitLinks, inferredLinks, linkCounts, providers] = await Promise.all([
    prisma.match.findFirst({
      where: { userId, scholarshipId: id },
      select: { score: true, matchStrength: true, factorScores: true, missingRequirements: true, recommendedActions: true },
    }),
    prisma.savedOpportunity.findFirst({ where: { userId, scholarshipId: id }, select: { id: true } }),
    prisma.application.findFirst({
      where: { userId, scholarshipId: id },
      select: { id: true, documents: { select: { id: true, name: true, completed: true }, orderBy: { id: "asc" } } },
    }),
    getComparisonProfile(userId),
    prisma.fundingOpportunity.findMany({
      where: { scholarshipId: id, linkMethod: "EXPLICIT_SOURCE" },
      orderBy: { confidence: "desc" },
      take: LINK_PREVIEW,
      select: linkSelect,
    }),
    prisma.fundingOpportunity.findMany({
      where: { scholarshipId: id, linkMethod: "RULE_INFERENCE" },
      orderBy: { confidence: "desc" },
      take: LINK_PREVIEW,
      select: linkSelect,
    }),
    prisma.fundingOpportunity.groupBy({ by: ["linkMethod"], where: { scholarshipId: id }, _count: { _all: true } }),
    providerInstitutions([id]),
  ]);

  const coverage = isCoverage(s.coverageType) ? s.coverageType : "UNKNOWN";
  const amount = posterAmount({ coverage, amount: s.amount === null ? null : Number(s.amount), currency: s.amountCurrency, per: amountPer(s.amountPeriod) });
  const face = providers.get(id) ?? providerFace(s.providerName);
  const factors = (match?.factorScores as unknown as FactorScore[] | undefined) ?? [];
  const info = matchInfo(match ?? undefined, s.verified);
  // The other group's EU / non-EU dates are not this student's deadlines.
  const applicantGroup = applicantGroupFor(profile?.nationality);
  const deadlines = s.deadlines.filter((d) => deadlineAppliesTo(d.intake, applicantGroup));
  const upcoming = deadlines.filter((d) => d.date && daysUntil(d.date, now) >= 0);
  const nextDated = upcoming[0] ?? null;
  const countOf = (m: string) => linkCounts.find((c) => c.linkMethod === m)?._count._all ?? 0;

  const toRow = (l: (typeof explicitLinks)[number]): WhereRow => ({
    id: l.id,
    programme: l.program ? { id: l.program.id, name: l.program.name } : null,
    institution: l.program ? toInstitutionFace(l.program.university) : l.university ? toInstitutionFace(l.university) : null,
  });
  const rule =
    (inferredLinks[0]?.inferenceBasis as { countries?: string[]; degreeLevels?: string[]; fieldCategories?: string[] } | null) ?? null;

  // --- Facts ----------------------------------------------------------------
  const nationality = s.eligibility.find((e) => e.criterionType === "NATIONALITY");
  const degrees = s.eligibility.filter((e) => e.criterionType === "DEGREE_LEVEL").flatMap((e) => e.valueList);
  const facts: Fact[] = [
    { label: "Amount", value: amount.text, note: amount.per },
    { label: "Coverage", value: COVERAGE_LABEL[coverage] },
  ];
  const deadlineText = usefulDeadlineText(s.deadlineText) ?? usefulDeadlineText(deadlines.find((d) => !d.date)?.dateText);
  if (nextDated?.date) {
    const days = daysUntil(nextDated.date, now);
    facts.push({ label: "Deadline", value: formatDate(nextDated.date, now), note: closesIn(days), noteTone: isUrgent(days) ? "red" : "muted" });
  } else if (deadlineText) {
    facts.push({ label: "Deadline", value: deadlineText.length <= 22 ? deadlineText : "See details", note: deadlineText.length <= 22 ? null : "Below, under Application" });
  }
  if (nationality && nationality.valueList.length > 0) {
    const list = nationality.valueList;
    facts.push({
      label: "Who can apply",
      value: list.length <= 2 ? joinList(list) : `${list.length} nationalities`,
      note: list.length > 2 ? `Including ${list.slice(0, 3).join(", ")}` : null,
    });
  }
  if (degrees.length > 0) {
    facts.push({ label: "Degree level", value: joinList([...new Set(degrees.map((d) => degreeLabel(d.toUpperCase()) ?? d))]) });
  }

  // --- Steps, dates, related ------------------------------------------------
  const steps = deriveNextSteps({
    kind: "SCHOLARSHIP",
    blockers: blockersOf(factors),
    requirements: s.eligibility.map((e) => ({ type: e.criterionType, testName: e.textValue })),
    deadline: nextDated?.date ?? null,
    now,
  });
  const keyDates = deadlines.flatMap((d): KeyDate[] => {
    const intake = intakeLabel(d.intake);
    if (d.date) return [{ label: `Application deadline${intake ? ` (${intake})` : ""}`, date: d.date.toISOString() }];
    const text = usefulDeadlineText(d.dateText);
    return text ? [{ label: "Deadline", date: null, text }] : [];
  });
  if (keyDates.length === 0 && deadlineText) keyDates.push({ label: "Deadline", date: null, text: deadlineText });

  const similar = await prisma.match.findMany({
    where: {
      userId,
      matchType: "SCHOLARSHIP",
      scholarshipId: { not: id },
      matchStrength: { not: "MISSING_REQUIREMENT" },
      scholarship: s.country ? { OR: [{ coverageType: s.coverageType }, { country: s.country }] } : { coverageType: s.coverageType },
    },
    orderBy: { score: "desc" },
    take: 12,
    select: { scholarshipId: true, score: true, matchStrength: true, factorScores: true },
  });
  const savedRows = await prisma.savedOpportunity.findMany({
    where: { userId, scholarshipId: { in: similar.flatMap((m) => (m.scholarshipId ? [m.scholarshipId] : [])) } },
    select: { scholarshipId: true },
  });
  const similarCards =
    similar.length >= 3
      ? await buildScholarshipCards(
          similar.flatMap((m) => (m.scholarshipId ? [m.scholarshipId] : [])),
          { matches: new Map(similar.map((m) => [m.scholarshipId!, m])), saved: new Set(savedRows.map((r) => r.scholarshipId!)), now, applicantGroup },
        )
      : [];

  const band = posterBand(coverage);

  return (
    <div className="pb-16">
      {/* Banner: the coverage band with the rosette instead of a photo (§9.4) */}
      <section aria-labelledby="page-title" className={`relative isolate overflow-hidden text-white ${POSTER_BAND_BG[band]}`}>
        <Rosette size={560} className="-top-[180px] -right-[140px]" />
        <Rosette size={320} className="-bottom-[160px] left-[38%] hidden md:block" />
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-[150px] bg-[linear-gradient(180deg,rgba(7,29,51,.55),rgba(7,29,51,0))]" />
        <div className="relative flex min-h-[440px] flex-col justify-end gap-6 px-gutter pt-24 pb-11 md:pt-28">
          <NightBreadcrumb
            crumbs={[
              { label: "Scholarships", href: "/scholarships" },
              ...(s.country ? [{ label: countryName(s.country), href: `/scholarships?country=${encodeURIComponent(s.country)}` }] : []),
              { label: s.name },
            ]}
          />
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex min-w-0 max-w-[820px] flex-col gap-5">
              <div className="flex items-center gap-4">
                <InstitutionLogo name={face.name} logoUrl={face.logoUrl} acronym={face.acronym} seed={face.id} size={72} surface="image" />
                <div className="min-w-0">
                  {providers.get(id) ? (
                    <Link href={`/institutions/${face.id}`} className="text-[17px] font-bold text-white hover:underline">
                      {s.providerName}
                    </Link>
                  ) : (
                    <p className="text-[17px] font-bold text-white">{s.providerName}</p>
                  )}
                  <SourceBadge verified={s.verified} tone="night" className="mt-1.5" />
                </div>
              </div>
              <h1 id="page-title" className="type-display-l">
                {s.name}
              </h1>
              <div className="flex flex-wrap gap-2">
                <Pill tone="night">{s.country ? countryName(s.country) : "Multiple countries"}</Pill>
                <Pill tone="night">
                  <Coins aria-hidden="true" className="size-3.5" />
                  {COVERAGE_LABEL[coverage]}
                </Pill>
                {degrees.length > 0 && <Pill tone="night">{joinList([...new Set(degrees.map((d) => degreeLabel(d.toUpperCase()) ?? d))])}</Pill>}
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-4 lg:items-end">
              <div className="lg:text-right">
                {amount.confirmed ? (
                  <p className="type-display-l tabular-nums">{amount.text}</p>
                ) : (
                  <p className="font-display text-[26px] leading-tight font-bold text-white/[.88]">Amount to be confirmed</p>
                )}
                {amount.per && <p className="mt-1 text-base text-white/[.88]">{amount.per}</p>}
              </div>
              <BannerScoreCard match={info} basis={basisLine(factors)} />
            </div>
          </div>
        </div>
      </section>

      {/* Action bar */}
      <div className="border-b border-line bg-white px-gutter py-3.5">
        <div className="flex flex-wrap items-center gap-3">
          <TrackButton targetType="SCHOLARSHIP" targetId={id} title={s.name} initialTracking={Boolean(application)} refreshOnTrack />
          <a
            href={s.applicationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 items-center gap-2 rounded-full border border-line-strong bg-white px-5 text-base font-bold text-ink hover:border-kick-blue hover:text-kick-blue"
          >
            Apply now <ExternalLink aria-hidden="true" className="size-[18px]" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
          <div className="flex items-center gap-2 sm:ml-auto">
            <SaveButton targetType="scholarship" targetId={id} title={s.name} initialSaved={Boolean(saved)} />
            <ShareButton title={s.name} />
          </div>
        </div>
      </div>

      <div className="box-content max-w-[1328px] px-gutter">
        <FactGrid facts={facts} className="mt-6" />

        <div className="mt-6 flex flex-wrap items-start gap-6">
          <div className="flex min-w-0 max-w-[860px] flex-[999_1_560px] flex-col gap-6">
            <Panel id="overview" title="About this scholarship">
              <p className="max-w-[70ch] text-base leading-relaxed text-ink-2">
                {s.description ? cleanSourceText(s.description) : "No description available yet."}
              </p>
              {s.isRenewable && <p className="mt-3 text-[15px] font-bold text-green-text">Renewable each year, according to the source.</p>}
              {!s.verified && (
                <p className="mt-5 flex gap-2.5 rounded-xl bg-grey-tint p-3.5 text-sm leading-relaxed text-slate">
                  <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  This scholarship was discovered via a third-party aggregator and has not yet been independently verified
                  against an official source. Treat the details here as a starting point, not confirmed fact.
                </p>
              )}
            </Panel>

            <Panel id="why" title="Why you match" intro={match ? "Your profile, checked against the eligibility rules the provider publishes." : undefined}>
              {match ? (
                <div className="space-y-8">
                  <RequirementComparison rows={scholarshipRows(s.eligibility, factors, profile)} />
                  <div>
                    <h3 className="text-base font-bold text-ink">Score breakdown</h3>
                    <div className="mt-3">
                      <ScoreBreakdown factors={factors.filter((f) => f.score !== null)} />
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
                  to see why you match this scholarship.
                </p>
              )}
            </Panel>

            <Panel id="eligibility" title="Eligibility">
              {s.eligibility.length === 0 ? (
                <p className="text-[15px] text-ink-3">No structured eligibility criteria published yet.</p>
              ) : (
                <ul role="list" className="divide-y divide-line">
                  {s.eligibility.map((e) => (
                    <li key={e.id} className="flex flex-wrap items-start justify-between gap-3 py-3.5 first:pt-0 last:pb-0">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-ink">{criterionLabel(e.criterionType)}</p>
                        {e.description && <p className="mt-1 max-w-[70ch] text-[15px] text-ink-2">{cleanSourceText(e.description)}</p>}
                      </div>
                      <RequirementBadge verified={e.verified} />
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel id="where" title="Where this can be used">
              <WhereUsed
                explicit={explicitLinks.map(toRow)}
                inferred={inferredLinks.map(toRow)}
                explicitTotal={countOf("EXPLICIT_SOURCE")}
                inferredTotal={countOf("RULE_INFERENCE")}
                rule={rule}
              />
            </Panel>

            <Panel id="application" title="Application">
              <div className="space-y-4">
                {upcoming.length > 0 ? (
                  <ul role="list" className="space-y-2">
                    {upcoming.map((d) => (
                      <li key={d.id} className="flex items-center justify-between gap-4 rounded-tile bg-paper px-4 py-3">
                        <span className="text-[15px] font-bold text-ink">
                          Application deadline
                          {intakeLabel(d.intake) && <span className="block text-sm font-normal text-ink-3">{intakeLabel(d.intake)}</span>}
                        </span>
                        <span className="shrink-0 text-[15px] font-bold text-kick-red tabular-nums">{formatFullDate(d.date!)}</span>
                      </li>
                    ))}
                  </ul>
                ) : s.deadlineText ? (
                  <p className="max-w-[70ch] text-[15px] text-ink-2">{cleanSourceText(s.deadlineText)}</p>
                ) : (
                  <p className="text-[15px] text-ink-3">No deadline published yet.</p>
                )}
                <a
                  href={s.applicationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-12 items-center gap-2 rounded-full bg-kick-blue px-6 text-base font-bold text-white hover:bg-kick-blue-hover"
                >
                  Apply now <ExternalLink aria-hidden="true" className="size-[18px]" />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </div>
            </Panel>
          </div>

          <aside aria-label="Plan and sources" className="flex min-w-0 flex-[1_1_340px] flex-col gap-6">
            <NextSteps steps={steps} checklist={application?.documents ?? null} target={{ type: "SCHOLARSHIP", id, title: s.name }} />
            <KeyDates dates={keyDates} intakes={[]} now={now} />
            <ProvenanceCard
              sourceName={s.primarySource.name}
              sourceUrl={s.sourceUrl}
              checkedAt={s.lastVerifiedAt ?? s.primarySource.lastSuccessfulCrawlAt}
              officialUrl={s.officialSourceUrl}
              subject={s.name}
            />
          </aside>
        </div>
      </div>

      {similarCards.length >= 3 && (
        <div className="mt-12">
          <Rail id="similar" title="More like this" prevLabel="Previous scholarships" nextLabel="More scholarships">
            {similarCards.map((c) => (
              <FundingPoster key={c.id} card={c} now={now} />
            ))}
          </Rail>
        </div>
      )}
    </div>
  );
}
