import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CircleAlert, TrendingUp } from "lucide-react";
import { auth } from "@/lib/auth";
import { getEligibilityReport, type RankedAdvice } from "@/lib/eligibility/getEligibilityReport";
import { actionHref } from "@/lib/ui/requirements";
import { formatCount } from "@/lib/ui/format";
import { isStrength } from "@/lib/ui/strength";
import { ScoreDial } from "@/components/kick/score-dial";
import { StrengthBadge } from "@/components/kick/badges";
import { ScoreBreakdown } from "@/components/kick/detail/panels";
import { InstitutionLogo } from "@/components/kick/institution-logo";

export const metadata: Metadata = { title: "Eligibility report" };

/**
 * One piece of advice, with the opportunities behind it named, so the claim
 * is checkable and the row is a route into the catalogue.
 */
function AdviceRow({ advice, tone }: { advice: RankedAdvice; tone: "red" | "blue" }) {
  const remaining = advice.affects - advice.examples.length;
  return (
    <li className="rounded-tile bg-white p-4 shadow-hairline">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {tone === "blue" ? (
            <Link href={actionHref(advice.text)} className="text-[15px] font-bold text-kick-blue hover:underline">
              {advice.text}
            </Link>
          ) : (
            <p className="text-[15px] font-bold text-ink">{advice.text}</p>
          )}
          {advice.detail && <p className="mt-0.5 text-sm text-ink-3">{advice.detail}</p>}
        </div>
        <span className="shrink-0 rounded-full bg-grey-tint px-2.5 py-1 type-caption text-slate tabular-nums">
          {formatCount(advice.affects)} {advice.affects === 1 ? "match" : "matches"}
        </span>
      </div>
      {advice.examples.length > 0 && (
        <p className="mt-2.5 text-sm text-ink-3">
          {advice.examples.map((e, i) => (
            <span key={e.href}>
              {i > 0 && ", "}
              <Link href={e.href} className="font-bold text-kick-blue hover:underline">
                {e.name}
              </Link>
            </span>
          ))}
          {remaining > 0 && ` and ${formatCount(remaining)} more`}
        </p>
      )}
    </li>
  );
}

export default async function EligibilityPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const report = await getEligibilityReport(session.user.id);

  if (!report.hasProfile) {
    return (
      <div className="box-content max-w-[640px] px-gutter py-16">
        <h1 className="type-page-h1 text-ink">Eligibility report</h1>
        <p className="mt-3 text-base text-ink-3">Complete your profile first to see your eligibility breakdown.</p>
        <Link href="/profile" className="mt-6 inline-flex h-12 items-center rounded-full bg-kick-blue px-6 font-bold text-white hover:bg-kick-blue-hover">
          Complete your profile
        </Link>
      </div>
    );
  }

  return (
    <div className="box-content max-w-[860px] space-y-10 px-gutter pt-6 pb-16 md:pt-10">
      <div>
        <h1 className="type-page-h1 text-ink">Eligibility report</h1>
        <p className="mt-2 type-body-sm text-ink-3">Where your profile stands, and what to fix first.</p>
      </div>

      {/* Two numbers: the average across everything is dragged down by
          opportunities nobody would pursue, so the strongest set's average is
          shown beside it as the realistic target. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex items-center gap-5 rounded-panel bg-white p-6 shadow-hairline">
          <ScoreDial score={report.bestScore} size={88} label={`${report.bestScore} percent average across your strongest opportunities`} />
          <div>
            <p className="text-base font-bold text-ink">Your strongest opportunities</p>
            <p className="mt-0.5 text-sm text-ink-3">Average across your best matches</p>
          </div>
        </div>
        <div className="flex items-center gap-5 rounded-panel bg-white p-6 shadow-hairline">
          <p className="font-display text-[44px] leading-none font-[750] text-ink tabular-nums">{report.overallScore}%</p>
          <div>
            <p className="text-base font-bold text-ink">Across the whole catalogue</p>
            <p className="mt-0.5 text-sm text-ink-3 tabular-nums">
              {formatCount(report.totals.all)} matches · {formatCount(report.totals.programs)} programmes, {formatCount(report.totals.scholarships)} scholarships
            </p>
          </div>
        </div>
      </div>

      {report.strengthCounts.length > 0 && (
        <ul role="list" aria-label="Matches by strength" className="flex flex-wrap gap-2">
          {report.strengthCounts.map(({ strength, count }) =>
            isStrength(strength) ? (
              <li key={strength} className="flex items-center gap-2 rounded-full bg-white py-1 pr-3.5 pl-1 shadow-hairline">
                <StrengthBadge strength={strength} />
                <span className="text-[15px] font-bold text-ink tabular-nums">{formatCount(count)}</span>
              </li>
            ) : null,
          )}
        </ul>
      )}

      <section aria-labelledby="breakdown-title" className="rounded-panel bg-white p-5 shadow-hairline md:p-6">
        <h2 id="breakdown-title" className="type-section-h2 text-ink">
          Score breakdown
        </h2>
        <p className="mt-1 mb-5 type-body-sm text-ink-3">Average of each factor across all your matches.</p>
        <ScoreBreakdown factors={report.averageFactorScores.map((f) => ({ factor: f.factor, score: f.score, explanation: f.sampleExplanation }))} />
      </section>

      {report.blockers.length > 0 && (
        <section aria-labelledby="blockers-title">
          <h2 id="blockers-title" className="flex items-center gap-2 type-section-h2 text-ink">
            <CircleAlert aria-hidden="true" className="size-6 text-kick-red" />
            What&apos;s holding your score back
          </h2>
          <p className="mt-1 type-body-sm text-ink-3">Ordered by how many of your matches each one affects.</p>
          <ul role="list" className="mt-4 space-y-3">
            {report.blockers.map((b) => (
              <AdviceRow key={b.text} advice={b} tone="red" />
            ))}
          </ul>
          {report.blockerOverflow > 0 && (
            <p className="mt-3 text-sm text-ink-3">
              and {report.blockerOverflow} less common {report.blockerOverflow === 1 ? "one" : "ones"}
            </p>
          )}
        </section>
      )}

      {report.recommendedActions.length > 0 && (
        <section aria-labelledby="actions-title">
          <h2 id="actions-title" className="flex items-center gap-2 type-section-h2 text-ink">
            <TrendingUp aria-hidden="true" className="size-6 text-kick-blue" />
            What you can do to improve it
          </h2>
          <p className="mt-1 type-body-sm text-ink-3">Biggest win first, by how many opportunities it would unlock.</p>
          <ul role="list" className="mt-4 space-y-3">
            {report.recommendedActions.map((a) => (
              <AdviceRow key={a.text} advice={a} tone="blue" />
            ))}
          </ul>
          {report.actionOverflow > 0 && <p className="mt-3 text-sm text-ink-3">and {report.actionOverflow} more</p>}
        </section>
      )}

      {report.topMatches.length > 0 && (
        <section aria-labelledby="top-title">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="top-title" className="type-section-h2 text-ink">
              Your strongest matches
            </h2>
            {/* Target kept as before; see open question 7 in docs/ui-remodel.md. */}
            <Link href="/scholarships" className="inline-flex min-h-11 items-center gap-1.5 text-[15px] font-bold text-kick-blue hover:underline">
              Browse all <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
          <ul role="list" className="mt-4 space-y-2.5">
            {report.topMatches.map((m) => (
              <li key={m.id}>
                <Link href={m.href} className="flex items-center gap-4 rounded-tile bg-white px-4 py-3 shadow-hairline transition-shadow hover:shadow-preview">
                  <InstitutionLogo name={m.face.name} logoUrl={m.face.logoUrl} acronym={m.face.acronym} seed={m.face.id} size={44} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-bold text-ink">{m.name}</span>
                    <span className="block truncate text-sm text-ink-3">
                      {m.type === "PROGRAM" ? "Programme" : "Scholarship"} · {m.face.name}
                    </span>
                  </span>
                  {isStrength(m.matchStrength) && (
                    <>
                      <StrengthBadge strength={m.matchStrength} className="hidden sm:inline-flex" />
                      <ScoreDial score={m.score} strength={m.matchStrength} size={46} />
                    </>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
