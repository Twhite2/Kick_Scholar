import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getEligibilityReport } from "@/lib/eligibility/getEligibilityReport";
import { FactorScoreBar } from "@/components/eligibility/factor-score-bar";
import { MatchStrengthBadge } from "@/components/eligibility/match-strength-badge";
import { Mono } from "@/components/ui/mono";
import { Button } from "@/components/ui/button";

export default async function EligibilityPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const report = await getEligibilityReport(session.user.id);

  if (!report.hasProfile) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center md:px-8">
        <h1 className="text-2xl font-semibold tracking-tight">Eligibility Report</h1>
        <p className="mt-2 text-muted-foreground">Complete your profile first to see your eligibility breakdown.</p>
        <Button size="lg" className="mt-6" render={<Link href="/profile">Complete your profile</Link>} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8 md:px-8 md:py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Eligibility Report</h1>
        <p className="mt-1 text-muted-foreground">
          A breakdown of your overall fit across every program and scholarship you match.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-6 text-center">
        <Mono className="block text-4xl font-semibold text-kick-blue">{report.overallScore}%</Mono>
        <p className="mt-1 text-sm text-muted-foreground">Overall match, averaged across {report.matches.length} opportunities</p>
      </div>

      <div className="space-y-5">
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Factor Breakdown</h2>
        {report.averageFactorScores.map((f) => (
          <FactorScoreBar key={f.factor} factor={f.factor} score={f.score} explanation={f.sampleExplanation} />
        ))}
      </div>

      {report.missingRequirements.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-destructive">What&apos;s holding your score back</h2>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted-foreground">
            {report.missingRequirements.map((r) => <li key={r}>{r}</li>)}
          </ul>
        </div>
      )}

      {report.recommendedActions.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-kick-blue">What you can do to improve it</h2>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted-foreground">
            {report.recommendedActions.map((a) => <li key={a}>{a}</li>)}
          </ul>
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">All Matches</h2>
        <div className="mt-3 divide-y divide-border rounded-2xl border border-border">
          {report.matches.map((m) => (
            <Link
              key={m.id}
              href={m.href}
              className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{m.name}</p>
                <span className="text-xs text-muted-foreground">{m.type === "PROGRAM" ? "Program" : "Scholarship"}</span>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <MatchStrengthBadge strength={m.matchStrength} />
                <Mono className="w-10 text-right text-sm font-medium">{m.score}%</Mono>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
