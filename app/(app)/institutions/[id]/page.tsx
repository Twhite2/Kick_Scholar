import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ExternalLink, MapPin, CalendarDays } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mono } from "@/components/ui/mono";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { COUNTRY_LABELS } from "@/lib/constants/countryNames";

/** Enough to show the shape of the answer without an endless wall of rows. */
const LIST_LIMIT = 40;

export default async function InstitutionDetailPage({ params }: PageProps<"/institutions/[id]">) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { id } = await params;

  const university = await prisma.university.findUnique({
    where: { id },
    include: {
      programs: {
        orderBy: { name: "asc" },
        take: LIST_LIMIT,
        select: { id: true, name: true, degreeLevel: true, fieldCategory: true, durationMonths: true },
      },
      fundingOpportunities: {
        // Source-stated links first, then the most confident inferences.
        orderBy: [{ linkMethod: "asc" }, { confidence: "desc" }],
        take: LIST_LIMIT,
        include: { scholarship: { select: { id: true, name: true, providerName: true } } },
      },
      _count: { select: { programs: true, fundingOpportunities: true } },
    },
  });

  if (!university) notFound();

  const explicit = university.fundingOpportunities.filter((f) => f.linkMethod === "EXPLICIT_SOURCE");
  const inferred = university.fundingOpportunities.filter((f) => f.linkMethod === "RULE_INFERENCE");

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 md:px-8 md:py-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{university.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <MapPin className="size-4" />
              {university.city}, {COUNTRY_LABELS[university.country] ?? university.country}
            </span>
            {university.foundedYear && (
              <span className="flex items-center gap-1.5">
                <CalendarDays className="size-4" />
                Founded {university.foundedYear}
              </span>
            )}
            {university.type && <Badge variant="outline">{university.type}</Badge>}
          </p>
        </div>
        <Button
          variant="outline"
          render={
            <a href={university.website} target="_blank" rel="noopener noreferrer">
              Website <ExternalLink className="ml-1.5 size-4" />
            </a>
          }
        />
      </div>

      <dl className="grid grid-cols-2 gap-4 rounded-xl border border-border p-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">Programmes</dt>
          <dd className="font-medium">
            <Mono>{university._count.programs}</Mono>
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Linked scholarships</dt>
          <dd className="font-medium">
            <Mono>{university._count.fundingOpportunities}</Mono>
          </dd>
        </div>
        {university.rorId && (
          <div>
            <dt className="text-muted-foreground">ROR identifier</dt>
            <dd className="font-medium">
              <a
                href={`https://ror.org/${university.rorId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-kick-blue hover:underline"
              >
                <Mono>{university.rorId}</Mono>
              </a>
            </dd>
          </div>
        )}
      </dl>

      <Tabs defaultValue="programs">
        <TabsList>
          <TabsTrigger value="programs">Programmes</TabsTrigger>
          <TabsTrigger value="funding">Scholarships</TabsTrigger>
        </TabsList>

        <TabsContent value="programs" className="space-y-3 pt-4">
          {university.programs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No programmes recorded for this institution yet. Its scholarships still apply at the
              institution level.
            </p>
          ) : (
            <>
              {university.programs.map((p) => (
                <Link
                  key={p.id}
                  href={`/programs/${p.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border p-4 transition-colors hover:bg-muted"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.fieldCategory.replace(/_/g, " ").toLowerCase()}
                      {p.durationMonths ? ` · ${p.durationMonths} months` : ""}
                    </p>
                  </div>
                  <Badge variant="outline">{p.degreeLevel.replace("_", " ")}</Badge>
                </Link>
              ))}
              {university._count.programs > LIST_LIMIT && (
                <p className="text-xs text-muted-foreground">
                  and {university._count.programs - LIST_LIMIT} more
                </p>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="funding" className="space-y-5 pt-4">
          {university.fundingOpportunities.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No scholarships linked to this institution yet.
            </p>
          ) : (
            <>
              {[
                {
                  title: "Officially linked",
                  note: "Named directly by the scholarship provider.",
                  rows: explicit,
                },
                {
                  title: "May apply here",
                  note: "Matched from each scholarship's own stated rules, not confirmed by the provider. Check before applying.",
                  rows: inferred,
                },
              ].map(({ title, note, rows }) =>
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
                          variant={fo.linkMethod === "EXPLICIT_SOURCE" ? "secondary" : "outline"}
                        >
                          {fo.fundingType.replace(/_/g, " ")}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                ),
              )}
              {university._count.fundingOpportunities > LIST_LIMIT && (
                <p className="text-xs text-muted-foreground">
                  and {university._count.fundingOpportunities - LIST_LIMIT} more matching the same
                  rules
                </p>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
