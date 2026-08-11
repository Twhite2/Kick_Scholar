import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mono } from "@/components/ui/mono";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MatchStrengthBadge } from "@/components/eligibility/match-strength-badge";
import { FactorScoreBar } from "@/components/eligibility/factor-score-bar";
import { OfficialVsExternalBadge } from "@/components/scholarships/official-vs-external-badge";
import { FundingCoverageViz } from "@/components/scholarships/funding-coverage-viz";
import { SaveButton } from "@/components/programs/save-button";
import type { FactorScore } from "@/lib/matching/types";

export default async function ScholarshipDetailPage({ params }: PageProps<"/scholarships/[id]">) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { id } = await params;

  const [scholarship, match, saved] = await Promise.all([
    prisma.scholarship.findUnique({
      where: { id },
      include: {
        eligibility: true,
        deadlines: true,
        fundingOpportunities: { include: { program: { include: { university: true } } } },
      },
    }),
    prisma.match.findFirst({ where: { userId: session.user.id, scholarshipId: id } }),
    prisma.savedOpportunity.findFirst({ where: { userId: session.user.id, scholarshipId: id } }),
  ]);

  if (!scholarship) notFound();

  const factorScores = (match?.factorScores as unknown as FactorScore[] | undefined) ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 md:px-8 md:py-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            {match && <MatchStrengthBadge strength={match.matchStrength} />}
            <OfficialVsExternalBadge verified={scholarship.verified} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{scholarship.name}</h1>
          <p className="mt-1 text-muted-foreground">{scholarship.providerName}</p>
        </div>
        <div className="flex items-center gap-2">
          <SaveButton targetType="scholarship" targetId={scholarship.id} initialSaved={!!saved} />
          {match && (
            <div className="rounded-xl bg-surface px-4 py-2 text-center">
              <Mono className="block text-xl font-semibold text-kick-blue">{match.score}%</Mono>
              <span className="text-[10px] text-muted-foreground uppercase">Match</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">{scholarship.country ?? "Multiple countries"}</Badge>
        <Badge variant="outline">{scholarship.coverageType.replace(/_/g, " ")}</Badge>
        {scholarship.amount && (
          <Badge variant="outline">
            {Number(scholarship.amount).toLocaleString()} {scholarship.amountCurrency}
          </Badge>
        )}
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="eligibility">Eligibility</TabsTrigger>
          <TabsTrigger value="why-match" disabled={!match}>Why You Match</TabsTrigger>
          <TabsTrigger value="application">Application</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 pt-4">
          <p className="text-sm leading-relaxed">{scholarship.description ?? "No description available yet."}</p>
          <FundingCoverageViz coverageType={scholarship.coverageType} />

          {scholarship.fundingOpportunities.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold">Officially linked to</h4>
              <div className="mt-2 space-y-2">
                {scholarship.fundingOpportunities.map((fo) => (
                  <Link
                    key={fo.id}
                    href={`/programs/${fo.programId}`}
                    className="flex items-center justify-between rounded-xl border border-border p-3 text-sm transition-colors hover:bg-muted"
                  >
                    <span>{fo.program?.name}</span>
                    <Badge variant={fo.fundingType === "OFFICIAL_UNIVERSITY_SCHOLARSHIP" ? "secondary" : "outline"}>
                      {fo.fundingType.replace(/_/g, " ")}
                    </Badge>
                  </Link>
                ))}
              </div>
            </div>
          )}
          {!scholarship.verified && (
            <p className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">
              This scholarship was discovered via a third-party aggregator and has not yet been independently
              verified against an official source. Treat the details here as a starting point, not confirmed fact.
            </p>
          )}
        </TabsContent>

        <TabsContent value="eligibility" className="space-y-3 pt-4">
          {scholarship.eligibility.length === 0 ? (
            <p className="text-sm text-muted-foreground">No structured eligibility criteria published yet.</p>
          ) : (
            scholarship.eligibility.map((e) => (
              <div key={e.id} className="rounded-xl border border-border p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{e.criterionType.replace(/_/g, " ")}</span>
                  <Badge variant={e.verified ? "secondary" : "outline"}>
                    {e.verified ? "Verified" : "Unverified"}
                  </Badge>
                </div>
                {e.description && <p className="mt-1 text-xs text-muted-foreground">{e.description}</p>}
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="why-match" className="space-y-4 pt-4">
          {match ? (
            <>
              <div className="space-y-4">
                {factorScores
                  .filter((f) => f.score !== null)
                  .map((f) => (
                    <FactorScoreBar key={f.factor} factor={f.factor} score={f.score} explanation={f.explanation} />
                  ))}
              </div>
              {match.missingRequirements.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-destructive">What&apos;s holding your score back</h4>
                  <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted-foreground">
                    {match.missingRequirements.map((m) => <li key={m}>{m}</li>)}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              <Link href="/profile" className="text-kick-blue hover:underline">Complete your profile</Link> to see why you match this scholarship.
            </p>
          )}
        </TabsContent>

        <TabsContent value="application" className="space-y-4 pt-4">
          {scholarship.deadlines.length > 0 ? (
            <div className="space-y-2">
              {scholarship.deadlines.map((d) => (
                <div key={d.id} className="flex items-center justify-between rounded-xl border border-border p-4">
                  <span className="text-sm font-medium">{d.deadlineType.replace(/_/g, " ")}</span>
                  <Mono className="text-sm text-destructive">
                    {d.date ? d.date.toLocaleDateString() : d.dateText}
                  </Mono>
                </div>
              ))}
            </div>
          ) : scholarship.deadlineText ? (
            <p className="text-sm">{scholarship.deadlineText}</p>
          ) : (
            <p className="text-sm text-muted-foreground">No deadline published yet.</p>
          )}
          <Button render={<a href={scholarship.applicationUrl} target="_blank" rel="noopener noreferrer">Apply now <ExternalLink /></a>} />
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>
              Information sourced from{" "}
              <a href={scholarship.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-kick-blue hover:underline">
                {scholarship.providerName}
              </a>
              {scholarship.lastVerifiedAt && ` — last verified ${scholarship.lastVerifiedAt.toLocaleDateString()}`}
            </p>
            {scholarship.officialSourceUrl && scholarship.officialSourceUrl !== scholarship.sourceUrl && (
              <p>
                Official source:{" "}
                <a href={scholarship.officialSourceUrl} target="_blank" rel="noopener noreferrer" className="text-kick-blue hover:underline">
                  {scholarship.officialSourceUrl}
                </a>
              </p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
