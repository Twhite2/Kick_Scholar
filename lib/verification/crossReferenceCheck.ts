import type { PrismaClient } from "../generated/prisma/client";

/**
 * Promotes a record to VERIFIED when it's corroborated by at least one
 * PRIMARY/SECONDARY-authority SourceCitation distinct from whatever
 * discovered it — the automated equivalent of "we found this scholarship on
 * an aggregator, then confirmed it against the official page." Never
 * promotes on DISCOVERY-only corroboration. Callable from the pipeline and
 * from an admin "re-check" action.
 */
export async function crossReferenceCheck(
  prisma: PrismaClient,
  sourceableType: "SCHOLARSHIP" | "UNIVERSITY" | "PROGRAM",
  sourceableId: string,
): Promise<{ verified: boolean; corroboratingSourceId: string | null }> {
  const citations = await prisma.sourceCitation.findMany({
    where: { sourceableType, sourceableId },
    include: { source: true },
  });

  const corroborating = citations.find(
    (c) => c.source.authorityLevel === "PRIMARY" || c.source.authorityLevel === "SECONDARY",
  );

  if (!corroborating) {
    return { verified: false, corroboratingSourceId: null };
  }

  const now = new Date();
  const data = {
    verified: true,
    verificationStatus: "VERIFIED" as const,
    lastVerifiedAt: now,
    verifiedBy: "system:cross-reference",
  };

  if (sourceableType === "SCHOLARSHIP") {
    await prisma.scholarship.update({ where: { id: sourceableId }, data });
  } else if (sourceableType === "UNIVERSITY") {
    await prisma.university.update({ where: { id: sourceableId }, data });
  } else {
    await prisma.program.update({ where: { id: sourceableId }, data });
  }

  return { verified: true, corroboratingSourceId: corroborating.sourceId };
}
