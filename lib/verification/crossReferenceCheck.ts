import type { PrismaClient } from "../generated/prisma/client";
import type { AuthorityLevel } from "../generated/prisma/enums";

interface CitationForCheck {
  sourceId: string;
  source: { authorityLevel: AuthorityLevel };
}

/**
 * Picks the citation that independently corroborates a record, or null.
 *
 * Independent means a PRIMARY/SECONDARY source OTHER than the record's own
 * primary source. Without that exclusion a record corroborates itself: the
 * loader cites the source it is loading, so a single PRIMARY or SECONDARY
 * source used to verify everything it published just by being reloaded.
 */
export function findIndependentCorroboration<C extends CitationForCheck>(
  citations: C[],
  primarySourceId: string,
): C | null {
  return (
    citations.find(
      (c) =>
        c.sourceId !== primarySourceId &&
        (c.source.authorityLevel === "PRIMARY" || c.source.authorityLevel === "SECONDARY"),
    ) ?? null
  );
}

/**
 * Promotes a record to VERIFIED when it's corroborated by at least one
 * independent PRIMARY/SECONDARY-authority SourceCitation — the automated
 * equivalent of "we found this scholarship on an aggregator, then the
 * official source published it too." Never promotes on DISCOVERY-only
 * corroboration, and never overrides a decision an admin made by hand.
 * Callable from the pipeline and from an admin "re-check" action.
 */
export async function crossReferenceCheck(
  prisma: PrismaClient,
  sourceableType: "SCHOLARSHIP" | "UNIVERSITY" | "PROGRAM",
  sourceableId: string,
): Promise<{ verified: boolean; corroboratingSourceId: string | null }> {
  const select = { primarySourceId: true, verified: true, verifiedBy: true } as const;
  const record =
    sourceableType === "SCHOLARSHIP"
      ? await prisma.scholarship.findUniqueOrThrow({ where: { id: sourceableId }, select })
      : sourceableType === "UNIVERSITY"
        ? await prisma.university.findUniqueOrThrow({ where: { id: sourceableId }, select })
        : await prisma.program.findUniqueOrThrow({ where: { id: sourceableId }, select });

  // An admin's verify/reject is a human judgement the pipeline must not undo
  // on its next run.
  if (record.verifiedBy?.startsWith("admin:")) {
    return { verified: record.verified, corroboratingSourceId: null };
  }

  const citations = await prisma.sourceCitation.findMany({
    where: { sourceableType, sourceableId },
    include: { source: true },
  });

  const corroborating = findIndependentCorroboration(citations, record.primarySourceId);
  if (!corroborating) {
    return { verified: record.verified, corroboratingSourceId: null };
  }

  const data = {
    verified: true,
    verificationStatus: "VERIFIED" as const,
    lastVerifiedAt: new Date(),
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
