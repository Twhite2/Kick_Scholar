import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ScholarshipFilterPanel } from "@/components/scholarships/scholarship-filter-panel";
import { ScholarshipCard, type ScholarshipCardData } from "@/components/scholarships/scholarship-card";
import type { Prisma, ScholarshipCoverageType } from "@/lib/generated/prisma/client";

export default async function ScholarshipsPage({ searchParams }: PageProps<"/scholarships">) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : undefined;
  const country = typeof params.country === "string" ? params.country : undefined;
  const coverage = typeof params.coverage === "string" ? params.coverage : undefined;
  const verifiedOnly = params.verified === "true";

  const where: Prisma.ScholarshipWhereInput = {
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { providerName: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(country ? { country } : {}),
    ...(coverage ? { coverageType: coverage as ScholarshipCoverageType } : {}),
    ...(verifiedOnly ? { verified: true } : {}),
  };

  const [scholarships, matches, saved] = await Promise.all([
    prisma.scholarship.findMany({ where, orderBy: { name: "asc" } }),
    prisma.match.findMany({ where: { userId: session.user.id, matchType: "SCHOLARSHIP" } }),
    prisma.savedOpportunity.findMany({ where: { userId: session.user.id, opportunityType: "SCHOLARSHIP" } }),
  ]);

  const matchByScholarship = new Map(matches.map((m) => [m.scholarshipId, m]));
  const savedIds = new Set(saved.map((s) => s.scholarshipId));

  const cards: ScholarshipCardData[] = scholarships.map((s) => ({
    id: s.id,
    name: s.name,
    providerName: s.providerName,
    country: s.country,
    coverageType: s.coverageType,
    amount: s.amount ? Number(s.amount) : null,
    amountCurrency: s.amountCurrency,
    deadlineText: s.deadlineText,
    verified: s.verified,
    match: matchByScholarship.has(s.id)
      ? {
          score: matchByScholarship.get(s.id)!.score,
          matchStrength: matchByScholarship.get(s.id)!.matchStrength,
        }
      : null,
    saved: savedIds.has(s.id),
  }));

  cards.sort((a, b) => (b.match?.score ?? -1) - (a.match?.score ?? -1));

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 md:px-8 md:py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Scholarships</h1>
        <p className="mt-1 text-muted-foreground">{cards.length} scholarships found</p>
      </div>

      <ScholarshipFilterPanel />

      {cards.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
          No scholarships match your filters yet.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((scholarship) => (
            <ScholarshipCard key={scholarship.id} scholarship={scholarship} />
          ))}
        </div>
      )}
    </div>
  );
}
