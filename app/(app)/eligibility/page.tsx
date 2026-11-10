import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { auth } from "@/lib/auth";
import { getEligibilityReport, type RankedAdvice } from "@/lib/eligibility/getEligibilityReport";
import { FactorScoreBar } from "@/components/eligibility/factor-score-bar";
import { MatchStrengthBadge } from "@/components/eligibility/match-strength-badge";
import { Mono } from "@/components/ui/mono";
import { Button } from "@/components/ui/button";

/**
 * One piece of advice, with the opportunities behind it named.
 *
 * A bare count ("affects 130") asks the reader to take it on trust and gives
 * them nowhere to go. Naming a few, as links, makes the claim checkable and
 * turns the row into a route into the catalogue.
 */
function AdviceRow({ advice }: { advice: RankedAdvice }) {
  const remaining = advice.affects - advice.examples.length;
  return (
    <li className="rounded-xl border border-border p-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{advice.text}</p>
          {advice.detail && (
            <p className="mt-0.5 text-xs text-muted-foreground">{advice.detail}</p>
          )}
        </div>
        <Mono className="shrink-0 text-xs text-muted-foreground">
          {advice.affects.toLocaleString()}
        </Mono>
      </div>
      {advice.examples.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          {advice.examples.map((e, i) => (
            <span key={e.href}>
              {i > 0 && ", "}
              <Link href={e.href} className="text-kick-blue hover:underline">
                {e.name}
              </Link>
            </span>
          ))}
          {remaining > 0 && ` and ${remaining.toLocaleString()} more`}
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
      <div className="mx-auto max-w-2xl px-4 py-16 text-center md:px-8">
        <h1 className="text-2xl font-semibold tracking-tight">Eligibility Report</h1>
        <p className="mt-2 text-muted-foreground">
          Complete your profile first to see your eligibility breakdown.
        </p>
        <Button size="lg" className="mt-6" render={<Link href="/profile">Complete your profile</Link>} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8 md:px-8 md:py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Eligibility Report</h1>
        <p className="mt-1 text-muted-foreground">
          Where your profile stands, and what to fix first.
        </p>
      </div>

      {/* Two numbers rather than one: the average across everything is dragged
          down by opportunities nobody would pursue, so the average across the
          strongest is shown beside it as the realistic target. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-surface p-6 text-center">
          <Mono className="block text-4xl font-semibold text-kick-blue">{report.bestScore}%</Mono>
          <p className="mt-1 text-sm font-medium">Your strongest opportunities</p>
          <p className="text-xs text-muted-foreground">Average across your best matches</p>
        </div>
        <div className="rounded-2xl border border-border p-6 text-center">
          <Mono className="block text-4xl font-semibold">{report.overallScore}%</Mono>
          <p className="mt-1 text-sm font-medium">Across the whole catalogue</p>
          <p className="text-xs text-muted-foreground">
            {report.totals.all.toLocaleString()} matches &middot; {report.totals.programs.toLocaleString()} programmes,{" "}
            {report.totals.scholarships.toLocaleString()} scholarships
          </p>
        </div>
      </div>

      {report.strengthCounts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {report.strengthCounts.map(({ strength, count }) => (
            <span
              key={strength}
              className="flex items-center gap-2 rounded-xl border border-border px-3 py-1.5"
            >
              <MatchStrengthBadge strength={strength} />
              <Mono className="text-sm font-medium">{count.toLocaleString()}</Mono>
            </span>
          ))}
        </div>
      )}

      <div className="space-y-5">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Factor breakdown
        </h2>
        {report.averageFactorScores.map((f) => (
          <FactorScoreBar
            key={f.factor}
            factor={f.factor}
            score={f.score}
            explanation={f.sampleExplanation}
          />
        ))}
      </div>

      {report.blockers.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-destructive">What&apos;s holding your score back</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Ordered by how many of your matches each one affects.
          </p>
          <ul className="mt-3 space-y-2">
            {report.blockers.map((b) => (
              <AdviceRow key={b.text} advice={b} />
            ))}
          </ul>
          {report.blockerOverflow > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              and {report.blockerOverflow} less common {report.blockerOverflow === 1 ? "one" : "ones"}
            </p>
          )}
        </div>
      )}

      {report.recommendedActions.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-kick-blue">What you can do to improve it</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Biggest win first, by how many opportunities it would unlock.
          </p>
          <ul className="mt-3 space-y-2">
            {report.recommendedActions.map((a) => (
              <AdviceRow key={a.text} advice={a} />
            ))}
          </ul>
          {report.actionOverflow > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              and {report.actionOverflow} more
            </p>
          )}
        </div>
      )}

      {report.topMatches.length > 0 && (
        <div>
          <div className="flex items-end justify-between gap-3">
            <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              Your strongest matches
            </h2>
            <Link
              href="/scholarships"
              className="flex items-center gap-1 text-xs text-kick-blue hover:underline"
            >
              Browse all <ArrowRight className="size-3.5" />
            </Link>
          </div>
          <div className="mt-3 divide-y divide-border rounded-2xl border border-border">
            {report.topMatches.map((m) => (
              <Link
                key={m.id}
                href={m.href}
                className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{m.name}</p>
                  <span className="text-xs text-muted-foreground">
                    {m.type === "PROGRAM" ? "Programme" : "Scholarship"}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <MatchStrengthBadge strength={m.matchStrength} />
                  <Mono className="w-10 text-right text-sm font-medium">{m.score}%</Mono>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
