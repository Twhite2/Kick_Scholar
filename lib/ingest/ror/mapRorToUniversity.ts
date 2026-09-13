import { canonicalizeUrl } from "../../normalization/canonicalUrl";
import { universityDedupeKey } from "../../normalization/generateDedupeKey";
import type { RorRecord } from "./rorSchema";

/**
 * Root Wikidata class for higher education. Everything that is a
 * `subclass of*` this counts as a university for our purposes; the full
 * closure is fetched from Wikidata rather than hand-listed (see
 * wikidataVetting.ts).
 */
export const HIGHER_ED_ROOT_CLASS = "Q38723"; // higher education institution

/**
 * Fallback used only when the Wikidata closure query is unreachable.
 *
 * A hand-curated list was the original approach and it was measurably wrong:
 * it rejected Karelia, Tampere, Haaga-Helia and Humak Universities of
 * Applied Sciences because they are typed `Q19152599` ("university of
 * applied sciences"), plus Finland's National Defence University
 * (`Q140232724`, military academy) and Police University College
 * (`Q277845`, police academy) — all genuine higher-education institutions.
 * Only 17 of 49 Finnish records survived. The transitive closure of
 * Q38723 contains 918 classes and accepts all of them while still
 * correctly rejecting research institutes and secondary schools.
 */
export const FALLBACK_HIGHER_ED_CLASSES = new Set([
  "Q38723", // higher education institution
  "Q3918", // university
  "Q875538", // public university
  "Q902104", // private university
  "Q19152599", // university of applied sciences
  "Q189004", // college
  "Q1371037", // technical university
  "Q15936437", // research university
  "Q383092", // art school
  "Q1663017", // grande école
  "Q140232724", // military academy
  "Q277845", // police academy
]);

export interface MappedUniversity {
  rorId: string;
  name: string;
  country: string;
  city: string;
  region: string | null;
  website: string;
  foundedYear: number | null;
  dedupeKey: string;
  externalIds: Record<string, string>;
  /** Wikidata QID when ROR carries one — the vetting key. */
  wikidataId: string | null;
  /** The ROR record URL, used as this record's sourceUrl provenance. */
  sourceUrl: string;
}

export type MapSkipReason =
  | "not-active"
  | "not-education"
  | "no-name"
  | "no-country"
  | "no-city"
  | "no-website";

export type MapResult =
  | { ok: true; university: MappedUniversity }
  | { ok: false; reason: MapSkipReason; name: string | null; rorId: string };

/** Bare ROR id from the URL form: "https://ror.org/05pb4em20" -> "05pb4em20". */
export function bareRorId(id: string): string {
  return id.replace(/^https?:\/\/ror\.org\//, "");
}

function displayName(record: RorRecord): string | null {
  const preferred = record.names.find((n) => n.types.includes("ror_display"));
  if (preferred?.value) return preferred.value;
  const english = record.names.find((n) => n.lang === "en" && n.value);
  if (english?.value) return english.value;
  return record.names[0]?.value ?? null;
}

function websiteFor(record: RorRecord): string | null {
  const link = record.links.find((l) => l.type === "website" && l.value);
  const raw = link?.value ?? (record.domains[0] ? `https://${record.domains[0]}` : null);
  if (!raw) return null;
  try {
    return canonicalizeUrl(raw);
  } catch {
    return null;
  }
}

/**
 * Pure ROR record -> University field mapping.
 *
 * Never fabricates. `University.website` is non-null in the schema, so a
 * record with no website is skipped rather than given a guessed URL, and
 * `type` (PUBLIC/PRIVATE) is left null because ROR simply does not carry it.
 */
export function mapRorToUniversity(record: RorRecord): MapResult {
  const rorId = bareRorId(record.id);

  if (record.status !== "active") {
    return { ok: false, reason: "not-active", name: displayName(record), rorId };
  }
  if (!record.types.includes("education")) {
    return { ok: false, reason: "not-education", name: displayName(record), rorId };
  }

  const name = displayName(record);
  if (!name) return { ok: false, reason: "no-name", name: null, rorId };

  const geo = record.locations[0]?.geonames_details;
  const country = geo?.country_code?.toUpperCase() ?? null;
  if (!country) return { ok: false, reason: "no-country", name, rorId };

  const city = geo?.name ?? null;
  if (!city) return { ok: false, reason: "no-city", name, rorId };

  const website = websiteFor(record);
  if (!website) return { ok: false, reason: "no-website", name, rorId };

  const externalIds: Record<string, string> = {};
  for (const ext of record.external_ids) {
    const value = ext.preferred ?? ext.all[0];
    if (value) externalIds[ext.type] = value;
  }

  return {
    ok: true,
    university: {
      rorId,
      name,
      country,
      city,
      region: geo?.country_subdivision_name ?? null,
      website,
      foundedYear: record.established ?? null,
      dedupeKey: universityDedupeKey(name, country),
      externalIds,
      wikidataId: externalIds.wikidata ?? null,
      sourceUrl: record.id,
    },
  };
}

/**
 * True when any of Wikidata's P31 ("instance of") values for an institution
 * is a higher-education class.
 *
 * Deliberately "has at least one", never "has none of some banned class":
 * Hertie School is legitimately classified as BOTH a research institute
 * (Q31855) AND a private university (Q902104), so an exclusion-based rule
 * would delete a real university.
 */
export function isHigherEducation(
  p31ClassIds: readonly string[],
  higherEdClasses: ReadonlySet<string> = FALLBACK_HIGHER_ED_CLASSES,
): boolean {
  return p31ClassIds.some((qid) => higherEdClasses.has(qid));
}
