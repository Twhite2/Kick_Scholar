import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ExternalLink, MapPin, Clock, Languages } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mono } from "@/components/ui/mono";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MatchStrengthBadge } from "@/components/eligibility/match-strength-badge";
import { FactorScoreBar } from "@/components/eligibility/factor-score-bar";
import { SaveButton } from "@/components/programs/save-button";
import type { FactorScore } from "@/lib/matching/types";

export default async function ProgramDetailPage({ params }: PageProps<"/programs/[id]">) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { id } = await params;

  const [program, match, saved] = await Promise.all([
    prisma.program.findUnique({
      where: { id },
      include: {
        university: true,
        requirements: true,
        deadlines: true,
        fundingOpportunities: {
          orderBy: [{ linkMethod: "asc" }, { confidence: "desc" }],
          take: 40,
          include: { scholarship: true },
        },
      },
    }),
    prisma.match.findFirst({ where: { userId: session.user.id, programId: id } }),
    prisma.savedOpportunity.findFirst({ where: { userId: session.user.id, programId: id } }),
  ]);

  if (!program) notFound();

  const factorScores = (match?.factorScores as unknown as FactorScore[] | undefined) ?? [];

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 md:px-8 md:py-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          {match && <MatchStrengthBadge strength={match.matchStrength} className="mb-2" />}
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{program.name}</h1>
          <p className="mt-1 text-muted-foreground">{program.university.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <SaveButton targetType="program" targetId={program.id} initialSaved={!!saved} />
          {match && (
            <div className="rounded-xl bg-surface px-4 py-2 text-center">
              <Mono className="block text-xl font-semibold text-kick-blue">{match.score}%</Mono>
              <span className="text-[10px] text-muted-foreground uppercase">Match</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <MapPin className="size-4" /> {program.university.city}, {program.university.country}
        </span>
        {program.durationMonths && (
          <span className="flex items-center gap-1.5">
            <Clock className="size-4" /> {program.durationMonths} months
          </span>
        )}
        {program.instructionLanguages.length > 0 && (
          <span className="flex items-center gap-1.5">
            <Languages className="size-4" /> {program.instructionLanguages.join(", ")}
          </span>
        )}
        <Badge variant="outline">{program.degreeLevel.replace("_", " ")}</Badge>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="requirements">Requirements</TabsTrigger>
          <TabsTrigger value="why-match" disabled={!match}>Why You Match</TabsTrigger>
          <TabsTrigger value="funding">Funding</TabsTrigger>
          <TabsTrigger value="application">Application</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 pt-4">
          <p className="text-sm leading-relaxed">
            {program.description ?? "No description available from the source yet."}
          </p>
          <dl className="grid grid-cols-2 gap-4 rounded-xl border border-border p-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Field</dt>
              <dd className="font-medium">{program.fieldOfStudy}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Tuition</dt>
              <dd className="font-medium">
                {program.tuitionType === "FREE"
                  ? "Free"
                  : program.tuitionType === "PAID" && program.tuitionAmount
                    ? `${Number(program.tuitionAmount).toLocaleString()} ${program.tuitionCurrency}`
                    : program.tuitionType === "VARIES"
                      ? "Varies"
                      : "Not yet published"}
              </dd>
            </div>
            {program.intakes.length > 0 && (
              <div>
                <dt className="text-muted-foreground">Intakes</dt>
                <dd className="font-medium">{program.intakes.join(", ")}</dd>
              </div>
            )}
          </dl>
        </TabsContent>

        <TabsContent value="requirements" className="space-y-3 pt-4">
          {program.requirements.length === 0 ? (
            <p className="text-sm text-muted-foreground">No structured requirements published yet.</p>
          ) : (
            program.requirements.map((req) => (
              <div key={req.id} className="rounded-xl border border-border p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {req.requirementType.replace(/_/g, " ")}
                    {req.testName ? ` — ${req.testName}` : ""}
                  </span>
                  <Badge variant={req.verified ? "secondary" : "outline"}>
                    {req.verified ? "Verified" : "Unverified"}
                  </Badge>
                </div>
                {req.description && <p className="mt-1 text-xs text-muted-foreground">{req.description}</p>}
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="why-match" className="space-y-4 pt-4">
          {match ? (
            <>
              <div className="space-y-4">
                {factorScores.map((f) => (
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
              {match.recommendedActions.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-kick-blue">What you can do</h4>
                  <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted-foreground">
                    {match.recommendedActions.map((a) => <li key={a}>{a}</li>)}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              <Link href="/profile" className="text-kick-blue hover:underline">Complete your profile</Link> to see why you match this program.
            </p>
          )}
        </TabsContent>

        <TabsContent value="funding" className="space-y-3 pt-4">
          {program.fundingOpportunities.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No scholarships linked to this programme yet — check the Scholarships page for
              opportunities that may still apply.
            </p>
          ) : (
            <>
              {(() => {
                const explicit = program.fundingOpportunities.filter(
                  (fo) => fo.linkMethod === "EXPLICIT_SOURCE",
                );
                const inferred = program.fundingOpportunities.filter(
                  (fo) => fo.linkMethod === "RULE_INFERENCE",
                );
                const section = (
                  title: string,
                  note: string,
                  rows: typeof program.fundingOpportunities,
                ) =>
                  rows.length === 0 ? null : (
                    <div key={title} className="space-y-2">
                      <div>
                        <h4 className="text-sm font-semibold">{title}</h4>
                        <p className="text-xs text-muted-foreground">{note}</p>
                      </div>
                      {rows.map((fo) => (
                        <Link
                          key={fo.id}
                          href={`/scholarships/${fo.scholarshipId}`}
                          className="flex items-center justify-between gap-3 rounded-xl border border-border p-4 transition-colors hover:bg-muted"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{fo.scholarship.name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {fo.scholarship.providerName}
                            </p>
                          </div>
                          <Badge
                            variant={
                              fo.linkMethod === "EXPLICIT_SOURCE" ? "secondary" : "outline"
                            }
                          >
                            {fo.fundingType.replace(/_/g, " ")}
                          </Badge>
                        </Link>
                      ))}
                    </div>
                  );
                return (
                  <div className="space-y-6">
                    {section(
                      "Officially linked",
                      "Named directly by the scholarship provider.",
                      explicit,
                    )}
                    {section(
                      "May apply here",
                      "Matched from each scholarship's own stated rules — not confirmed by the provider. Check before applying.",
                      inferred,
                    )}
                  </div>
                );
              })()}
            </>
          )}
        </TabsContent>

        <TabsContent value="application" className="space-y-4 pt-4">
          {program.deadlines.length > 0 ? (
            <div className="space-y-2">
              {program.deadlines.map((d) => (
                <div key={d.id} className="flex items-center justify-between rounded-xl border border-border p-4">
                  <div>
                    <p className="text-sm font-medium">{d.deadlineType.replace(/_/g, " ")}</p>
                    <p className="text-xs text-muted-foreground">{d.intake}</p>
                  </div>
                  <Mono className="text-sm text-destructive">
                    {d.date ? d.date.toLocaleDateString() : d.dateText}
                  </Mono>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No deadlines published yet.</p>
          )}
          <Button render={<a href={program.programUrl} target="_blank" rel="noopener noreferrer">Apply on official site <ExternalLink /></a>} />
          <p className="text-xs text-muted-foreground">
            Information verified from{" "}
            <a href={program.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-kick-blue hover:underline">
              {program.university.name}
            </a>
            {program.lastVerifiedAt && ` — last verified ${program.lastVerifiedAt.toLocaleDateString()}`}
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
