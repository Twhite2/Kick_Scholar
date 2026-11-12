import type { PrismaClient } from "@/lib/generated/prisma/client";
import { linkDedupeKey } from "./inferApplicableLinks";

/**
 * Links a source states outright: "Hosted by the London School of
 * Economics", or an Erasmus Mundus consortium's partner list. They are
 * written as EXPLICIT_SOURCE, which the UI shows as "Officially linked", and
 * the rule linker never deletes or overwrites them (it skips their keys).
 *
 * An inferred row for the same scholarship and institution is upgraded in
 * place, since the source now states what the rule only implied.
 */

export interface StatedLink {
  scholarshipId: string;
  universityId: string;
  /** Set when the source names the programme too. */
  programId?: string | null;
  fundingType: "OFFICIAL_UNIVERSITY_SCHOLARSHIP" | "PARTNER_FUNDING" | "GOVERNMENT_SPONSORED" | "EXTERNAL_APPLICABLE";
  /** The page or file that states it. */
  sourceId: string;
  sourceUrl: string;
  /** The words that state it, kept as the link's evidence. */
  quote: string;
}

export async function writeExplicitLinks(
  prisma: PrismaClient,
  links: StatedLink[],
  opts: { dryRun?: boolean } = {},
): Promise<{ written: number; upgraded: number }> {
  let written = 0;
  let upgraded = 0;
  const authority = new Map<string, { authorityLevel: "PRIMARY" | "SECONDARY" | "DISCOVERY" }>();
  for (const link of links) {
    const dedupeKey = linkDedupeKey(link.scholarshipId, link.universityId, link.programId ?? null);
    const existing = await prisma.fundingOpportunity.findUnique({ where: { dedupeKey }, select: { linkMethod: true } });
    if (existing?.linkMethod === "RULE_INFERENCE") upgraded += 1;
    if (opts.dryRun) {
      written += 1;
      continue;
    }
    if (!authority.has(link.sourceId)) {
      const source = await prisma.source.findUnique({ where: { id: link.sourceId }, select: { authorityLevel: true } });
      authority.set(link.sourceId, { authorityLevel: (source?.authorityLevel as "PRIMARY" | "SECONDARY" | "DISCOVERY") ?? "SECONDARY" });
    }
    const { authorityLevel } = authority.get(link.sourceId)!;
    const primary = authorityLevel === "PRIMARY";
    const data = {
      scholarshipId: link.scholarshipId,
      universityId: link.universityId,
      programId: link.programId ?? null,
      fundingType: link.fundingType,
      linkMethod: "EXPLICIT_SOURCE" as const,
      inferenceBasis: { statedOn: link.sourceUrl, quote: link.quote },
      primarySourceId: link.sourceId,
      sourceUrl: link.sourceUrl,
      authorityLevel,
      confidence: primary ? 1 : 0.75,
      verified: primary,
      verificationStatus: primary ? ("VERIFIED" as const) : ("UNVERIFIED" as const),
      lastVerifiedAt: primary ? new Date() : null,
    };
    await prisma.fundingOpportunity.upsert({ where: { dedupeKey }, create: { dedupeKey, ...data }, update: data });
    written += 1;
  }
  return { written, upgraded };
}
