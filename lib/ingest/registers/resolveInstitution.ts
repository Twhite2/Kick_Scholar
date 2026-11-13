import type { PrismaClient } from "@/lib/generated/prisma/client";
import type { RegisterInstitution } from "./types";

/**
 * A register's institution, matched to one already in the catalogue.
 *
 * Registers write names in the national language ("Universiteit van
 * Amsterdam", "Université Paris-Saclay") while the catalogue holds ROR's
 * names, so exact names alone miss most of them. In order:
 *
 *   1. the institution's website (or a parent domain of it);
 *   2. the exact name within the country, accents and case folded;
 *   3. ROR's affiliation matcher, which exists for exactly this: it accepts
 *      only a match ROR itself marks as chosen, in the same country, and
 *      maps it to the catalogue by ROR id.
 *
 * No fuzzy guessing beyond that: an unmatched institution is reported, and
 * its programmes wait until it is imported (from ROR) under its own record.
 */

export interface InstitutionIndex {
  byHost: Map<string, string>;
  byName: Map<string, string>;
  byRor: Map<string, string>;
  names: Map<string, { name: string; website: string }>;
}

export function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const host = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.toLowerCase();
    return host.replace(/^www\d?\./, "") || null;
  } catch {
    return null;
  }
}

export const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export async function institutionIndex(prisma: PrismaClient): Promise<InstitutionIndex> {
  const rows = await prisma.university.findMany({ select: { id: true, name: true, country: true, website: true, domain: true, rorId: true } });
  const index: InstitutionIndex = { byHost: new Map(), byName: new Map(), byRor: new Map(), names: new Map() };
  for (const u of rows) {
    index.names.set(u.id, { name: u.name, website: u.website });
    for (const h of [hostOf(u.website), u.domain?.toLowerCase().replace(/^www\./, "") ?? null]) if (h && !index.byHost.has(h)) index.byHost.set(h, u.id);
    index.byName.set(`${fold(u.name)}|${u.country}`, u.id);
    if (u.rorId) index.byRor.set(u.rorId.replace(/^https?:\/\/ror\.org\//, ""), u.id);
  }
  return index;
}

/** Steps 1 and 2, which need no network. */
export function resolveLocally(inst: RegisterInstitution, index: Pick<InstitutionIndex, "byHost" | "byName">): string | null {
  const host = hostOf(inst.website);
  if (host) {
    const labels = host.split(".");
    for (let i = 0; i <= labels.length - 2; i++) {
      const hit = index.byHost.get(labels.slice(i).join("."));
      if (hit) return hit;
    }
  }
  for (const name of [inst.name, ...(inst.aliases ?? [])]) {
    const hit = index.byName.get(`${fold(name)}|${inst.country}`);
    if (hit) return hit;
  }
  return null;
}

const ROR_API = "https://api.ror.org/v2/organizations";
const USER_AGENT = "KickScholarBot/0.1 (+https://github.com/Twhite2/Kick_Scholar)";

interface RorAffiliationItem {
  chosen?: boolean;
  organization?: { id?: string; locations?: Array<{ geonames_details?: { country_code?: string } }> };
}

/** ROR's chosen match for a name, in the given country, as a short ROR id. */
export async function rorAffiliation(name: string, country: string, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  const res = await fetchImpl(`${ROR_API}?affiliation=${encodeURIComponent(name)}`, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
  if (!res.ok) return null;
  const body = (await res.json()) as { items?: RorAffiliationItem[] };
  const chosen = body.items?.find((i) => i.chosen);
  const inCountry = chosen?.organization?.locations?.some((l) => l.geonames_details?.country_code === country);
  return chosen && inCountry ? (chosen.organization?.id?.replace(/^https?:\/\/ror\.org\//, "") ?? null) : null;
}

/**
 * Adds an institution ROR knows but the catalogue lacks. The ROR import
 * skips institutions whose Wikidata class it cannot confirm as higher
 * education (Lyon 1, Lyon 3 and Cranfield among them); a national register
 * of accredited programmes listing it is that confirmation. Created exactly
 * as the ROR import creates one: SECONDARY, unverified, ROR as its source.
 */
export async function addFromRor(prisma: PrismaClient, rorId: string, fetchImpl: typeof fetch = fetch): Promise<AddedInstitution | null> {
  const { RorRecordSchema } = await import("../ror/rorSchema");
  const { mapRorToUniversity } = await import("../ror/mapRorToUniversity");
  const res = await fetchImpl(`${ROR_API}/${encodeURIComponent(rorId)}`, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
  if (!res.ok) return null;
  const parsed = RorRecordSchema.safeParse(await res.json());
  if (!parsed.success) return null;
  const mapped = mapRorToUniversity(parsed.data);
  if (!mapped.ok) return null;
  const u = mapped.university;
  const existing = await prisma.university.findFirst({ where: { OR: [{ rorId: u.rorId }, { dedupeKey: u.dedupeKey }] }, select: { id: true, name: true, website: true } });
  if (existing) return existing;
  const created = await prisma.university.create({
    data: {
      name: u.name,
      dedupeKey: u.dedupeKey,
      country: u.country,
      city: u.city,
      region: u.region,
      website: u.website,
      foundedYear: u.foundedYear,
      rorId: u.rorId,
      externalIds: u.externalIds,
      accreditation: [],
      primarySourceId: "src-ror",
      sourceUrl: u.sourceUrl,
      authorityLevel: "SECONDARY",
      confidence: 0.9,
      verified: false,
      verificationStatus: "UNVERIFIED",
    },
    select: { id: true, name: true, website: true },
  });
  await prisma.sourceCitation.upsert({
    where: { sourceableType_sourceableId_sourceId: { sourceableType: "UNIVERSITY", sourceableId: created.id, sourceId: "src-ror" } },
    create: { sourceableType: "UNIVERSITY", sourceableId: created.id, sourceId: "src-ror", role: "PRIMARY_MATCH" },
    update: { capturedAt: new Date() },
  });
  return created;
}

export interface AddedInstitution {
  id: string;
  name: string;
  website: string;
}

export class InstitutionResolver {
  private cache = new Map<string, string | null>();
  private lastCall = 0;
  rorLookups = 0;
  added: string[] = [];

  constructor(
    private readonly index: InstitutionIndex,
    private readonly opts: { useRor: boolean; addMissing?: (rorId: string) => Promise<AddedInstitution | null> } = { useRor: true },
  ) {}

  async resolve(inst: RegisterInstitution): Promise<string | null> {
    const key = `${inst.country}|${inst.code ?? ""}|${inst.name}`;
    if (this.cache.has(key)) return this.cache.get(key)!;
    let id = resolveLocally(inst, this.index);
    if (!id && this.opts.useRor) {
      for (const name of [inst.name, ...(inst.aliases ?? [])]) {
        // ROR asks for under 2,000 requests in five minutes.
        const wait = this.lastCall + 200 - Date.now();
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        this.lastCall = Date.now();
        this.rorLookups += 1;
        const rorId = await rorAffiliation(name, inst.country).catch(() => null);
        id = rorId ? (this.index.byRor.get(rorId) ?? null) : null;
        if (!id && rorId && this.opts.addMissing) {
          const added = await this.opts.addMissing(rorId).catch(() => null);
          if (added) {
            id = added.id;
            this.index.byRor.set(rorId, added.id);
            this.index.names.set(added.id, { name: added.name, website: added.website });
            this.added.push(added.name);
          }
        }
        if (id) break;
      }
    }
    this.cache.set(key, id);
    return id;
  }

  /** Website or exact name only, with no network call. */
  resolveLocal(inst: RegisterInstitution): string | null {
    return resolveLocally(inst, this.index);
  }

  nameOf(universityId: string) {
    return this.index.names.get(universityId)!;
  }
}
