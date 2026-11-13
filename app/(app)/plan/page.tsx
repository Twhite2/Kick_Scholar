import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { institutionFaceSelect, providerFace, toInstitutionFace } from "@/lib/cards/faces";
import { buildProgrammeCards, upcomingDeadlineWhere } from "@/lib/cards/programme-cards";
import type { ApplicantGroup } from "@/lib/deadlines/applicant-group";
import { getApplicantGroup } from "@/lib/deadlines/viewer-group";
import { buildScholarshipCards, providerInstitutions } from "@/lib/cards/scholarship-cards";
import { daysUntil } from "@/lib/ui/format";
import { cn } from "@/lib/utils";
import { ApplicationCard, type BoardCard } from "@/components/kick/plan/application-card";
import { MatchPosterCard } from "@/components/kick/match-poster-card";
import { FundingPoster } from "@/components/kick/funding-poster";
import { TrackButton } from "@/components/kick/track-button";
import { SaveButton } from "@/components/kick/save-button";

export const metadata: Metadata = { title: "My plan" };

/**
 * The board's columns, in order. The first is still "Saved" until the open
 * question about renaming it to "Interested" is answered (ui-remodel §4.2).
 */
const COLUMNS: Array<{ status: string; label: string }> = [
  { status: "SAVED", label: "Saved" },
  { status: "PLANNING", label: "Planning" },
  { status: "IN_PROGRESS", label: "In progress" },
  { status: "SUBMITTED", label: "Submitted" },
  { status: "ACCEPTED", label: "Accepted" },
  { status: "REJECTED", label: "Rejected" },
];

/** Saved and tracked in one place (docs/ui-remodel.md §9.7). */
export default async function PlanPage({ searchParams }: PageProps<"/plan">) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = session.user.id;
  const now = new Date();
  const params = await searchParams;

  const [applications, saved, matches, profile, applicantGroup] = await Promise.all([
    loadApplications(userId, now),
    prisma.savedOpportunity.findMany({ where: { userId }, orderBy: { savedAt: "desc" }, select: { programId: true, scholarshipId: true } }),
    prisma.match.findMany({ where: { userId }, select: { programId: true, scholarshipId: true, score: true, matchStrength: true, factorScores: true } }),
    prisma.studentProfile.findUnique({
      where: { userId },
      select: { currentGpa: true, languageProficiencies: { select: { testName: true, score: true } } },
    }),
    getApplicantGroup(userId),
  ]);
  const tab = params.tab === "saved" || params.tab === "applications" ? params.tab : applications.length > 0 ? "applications" : "saved";
  const trackedProgrammes = new Set(applications.flatMap((a) => (a.programId ? [a.programId] : [])));
  const trackedScholarships = new Set(applications.flatMap((a) => (a.scholarshipId ? [a.scholarshipId] : [])));

  const tabs = [
    { key: "applications", label: `Applications (${applications.length})` },
    { key: "saved", label: `Saved (${saved.length})` },
  ];

  return (
    <div className="pb-16">
      <div className="px-gutter pt-6 md:pt-10">
        <h1 className="type-page-h1 text-ink">My plan</h1>
        <p className="mt-2 type-body-sm text-ink-3">Everything you&apos;ve saved and the applications you&apos;re tracking.</p>
        <nav aria-label="My plan" className="mt-5 border-b border-line">
          <ul className="flex gap-6">
            {tabs.map((t) => (
              <li key={t.key}>
                <Link
                  href={`/plan?tab=${t.key}`}
                  aria-current={tab === t.key ? "page" : undefined}
                  className={cn(
                    "relative inline-flex min-h-12 items-center text-base font-bold tabular-nums",
                    "after:absolute after:inset-x-0 after:-bottom-px after:h-[3px] after:rounded-full after:content-['']",
                    tab === t.key ? "text-kick-blue after:bg-kick-blue" : "text-ink-3 hover:text-ink",
                  )}
                >
                  {t.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {tab === "applications" ? (
        <ApplicationsTab applications={applications} now={now} />
      ) : (
        <SavedTab
          savedProgrammeIds={saved.flatMap((s) => (s.programId ? [s.programId] : []))}
          savedScholarshipIds={saved.flatMap((s) => (s.scholarshipId ? [s.scholarshipId] : []))}
          matches={matches}
          profile={profile}
          trackedProgrammes={trackedProgrammes}
          trackedScholarships={trackedScholarships}
          now={now}
          applicantGroup={applicantGroup}
        />
      )}
    </div>
  );
}

async function loadApplications(userId: string, now: Date) {
  // EU-only or non-EU-only dates that are not this student's never count as theirs.
  const applicantGroup = await getApplicantGroup(userId);
  return prisma.application.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      opportunityType: true,
      programId: true,
      scholarshipId: true,
      documents: { select: { id: true, name: true, completed: true }, orderBy: { id: "asc" } },
      program: {
        select: {
          name: true,
          university: { select: institutionFaceSelect },
          deadlines: { where: upcomingDeadlineWhere(now, applicantGroup), orderBy: { date: "asc" }, take: 1, select: { date: true } },
        },
      },
      scholarship: {
        select: {
          name: true,
          providerName: true,
          verificationStatus: true,
          deadlines: { where: upcomingDeadlineWhere(now, applicantGroup), orderBy: { date: "asc" }, take: 1, select: { date: true } },
        },
      },
    },
  });
}

type Applications = Awaited<ReturnType<typeof loadApplications>>;

async function ApplicationsTab({ applications, now }: { applications: Applications; now: Date }) {
  if (applications.length === 0) {
    return (
      <div className="mx-gutter mt-8 rounded-panel border border-dashed border-line-strong bg-white px-6 py-12 text-center">
        <p className="text-base text-ink-2">No applications yet. Open a programme or scholarship and choose &ldquo;Track this application&rdquo; to start.</p>
        <Link href="/programs" className="mt-4 inline-flex h-11 items-center rounded-full bg-kick-blue px-5 text-[15px] font-bold text-white hover:bg-kick-blue-hover">
          Browse programmes
        </Link>
      </div>
    );
  }

  const providers = await providerInstitutions(applications.flatMap((a) => (a.scholarshipId ? [a.scholarshipId] : [])));
  const cards: BoardCard[] = applications.map((a) => {
    const deadline = a.program?.deadlines[0]?.date ?? a.scholarship?.deadlines[0]?.date ?? null;
    return {
      id: a.id,
      title: a.program?.name ?? a.scholarship?.name ?? "",
      href: a.opportunityType === "PROGRAM" ? `/programs/${a.programId}` : `/scholarships/${a.scholarshipId}`,
      organisation:
        a.program?.university.name ??
        (a.scholarship ? `${a.scholarship.providerName}${a.scholarship.verificationStatus === "REJECTED" ? " · No longer listed" : ""}` : ""),
      institution: a.program
        ? toInstitutionFace(a.program.university)
        : a.scholarship
          ? (providers.get(a.scholarshipId!) ?? providerFace(a.scholarship.providerName))
          : null,
      status: a.status === "WITHDRAWN" ? "REJECTED" : a.status,
      daysLeft: deadline ? daysUntil(deadline, now) : null,
      documents: a.documents,
    };
  });

  return (
    <div className="mt-6 grid gap-6 px-gutter md:grid-cols-2 xl:grid-cols-6 xl:gap-4">
      {COLUMNS.map((col) => {
        const items = cards.filter((c) => c.status === col.status);
        return (
          <section key={col.status} aria-labelledby={`col-${col.status}`} className="min-w-0">
            <h2
              id={`col-${col.status}`}
              className={cn(
                "flex items-center justify-between gap-2 border-b-2 pb-2 text-base font-bold tabular-nums",
                col.status === "ACCEPTED" ? "border-kick-green text-green-text" : col.status === "REJECTED" ? "border-kick-red text-red-text" : "border-line-strong text-ink",
              )}
            >
              {col.label} ({items.length})
            </h2>
            <div className="mt-3 space-y-3">
              {items.length === 0 ? (
                <p className="rounded-tile border border-dashed border-line-strong px-3 py-4 text-center text-sm text-ink-3">Nothing here yet</p>
              ) : (
                items.map((c) => <ApplicationCard key={c.id} card={c} />)
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

async function SavedTab({
  savedProgrammeIds,
  savedScholarshipIds,
  matches,
  profile,
  trackedProgrammes,
  trackedScholarships,
  now,
  applicantGroup,
}: {
  savedProgrammeIds: string[];
  savedScholarshipIds: string[];
  matches: Array<{ programId: string | null; scholarshipId: string | null; score: number; matchStrength: string; factorScores: unknown }>;
  profile: { currentGpa: number | null; languageProficiencies: Array<{ testName: string; score: number | null }> } | null;
  trackedProgrammes: Set<string>;
  trackedScholarships: Set<string>;
  now: Date;
  applicantGroup: ApplicantGroup | null;
}) {
  if (savedProgrammeIds.length + savedScholarshipIds.length === 0) {
    return (
      <div className="mx-gutter mt-8 rounded-panel border border-dashed border-line-strong bg-white px-6 py-12 text-center">
        <p className="text-base text-ink-2">Nothing saved yet. Browse programmes or scholarships and tap the bookmark to save them here.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <Link href="/programs" className="inline-flex h-11 items-center rounded-full bg-kick-blue px-5 text-[15px] font-bold text-white hover:bg-kick-blue-hover">
            Browse programmes
          </Link>
          <Link href="/scholarships" className="inline-flex h-11 items-center rounded-full border border-line-strong bg-white px-5 text-[15px] font-bold text-ink hover:border-kick-blue">
            Browse scholarships
          </Link>
        </div>
      </div>
    );
  }

  const programmeMatches = new Map(matches.flatMap((m) => (m.programId ? [[m.programId, m] as const] : [])));
  const scholarshipMatches = new Map(matches.flatMap((m) => (m.scholarshipId ? [[m.scholarshipId, m] as const] : [])));
  const [programmes, scholarships] = await Promise.all([
    buildProgrammeCards(savedProgrammeIds, { matches: programmeMatches, saved: new Set(savedProgrammeIds), profile, now, applicantGroup }),
    buildScholarshipCards(savedScholarshipIds, { matches: scholarshipMatches, saved: new Set(savedScholarshipIds), now, applicantGroup }),
  ]);
  // Saved records later found not to be awards drop out of the cards; list
  // them so the student sees why and can clear them.
  const listedIds = new Set(scholarships.map((c) => c.id));
  const unlisted = await prisma.scholarship.findMany({
    where: { id: { in: savedScholarshipIds.filter((id) => !listedIds.has(id)) }, verificationStatus: "REJECTED" },
    select: { id: true, name: true },
  });

  return (
    <div className="mt-8 space-y-12">
      {programmes.length > 0 && (
        <section aria-labelledby="saved-programmes" className="px-gutter">
          <h2 id="saved-programmes" className="type-section-h2 text-ink">
            Programmes <span className="font-normal text-ink-3 tabular-nums">· {programmes.length} saved</span>
          </h2>
          <ul role="list" className="mt-4 grid max-w-[1328px] gap-5 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]">
            {programmes.map((c) => (
              <li key={c.id} className="flex flex-col gap-2.5">
                <MatchPosterCard card={c} mode="grid" tracking={trackedProgrammes.has(c.id)} now={now} />
                <TrackButton targetType="PROGRAM" targetId={c.id} title={c.title} initialTracking={trackedProgrammes.has(c.id)} variant="outline" className="w-full" />
              </li>
            ))}
          </ul>
        </section>
      )}
      {scholarships.length > 0 && (
        <section aria-labelledby="saved-scholarships" className="px-gutter">
          <h2 id="saved-scholarships" className="type-section-h2 text-ink">
            Scholarships <span className="font-normal text-ink-3 tabular-nums">· {scholarships.length} saved</span>
          </h2>
          <ul role="list" className="mt-4 grid max-w-[1328px] gap-5 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]">
            {scholarships.map((c) => (
              <li key={c.id} className="flex flex-col gap-2.5">
                <FundingPoster card={c} mode="grid" now={now} />
                <TrackButton targetType="SCHOLARSHIP" targetId={c.id} title={c.title} initialTracking={trackedScholarships.has(c.id)} variant="outline" className="w-full" />
              </li>
            ))}
          </ul>
        </section>
      )}
      {unlisted.length > 0 && (
        <section aria-labelledby="saved-unlisted" className="px-gutter">
          <h2 id="saved-unlisted" className="type-section-h2 text-ink">
            No longer listed <span className="font-normal text-ink-3 tabular-nums">· {unlisted.length}</span>
          </h2>
          <p className="mt-1 max-w-[70ch] type-body-sm text-ink-3">These were pages from a provider&apos;s website, not scholarships you can apply for.</p>
          <ul role="list" className="mt-4 max-w-[760px] space-y-2">
            {unlisted.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-4 rounded-tile bg-white px-4 py-3 shadow-hairline">
                <Link href={`/scholarships/${s.id}`} className="min-w-0 truncate text-[15px] font-bold text-ink hover:text-kick-blue">
                  {s.name}
                </Link>
                <SaveButton targetType="scholarship" targetId={s.id} title={s.name} initialSaved />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
