import type { Prisma } from "@/lib/generated/prisma/client";
import type { DegreeLevel, FieldCategory, ScholarshipCoverageType, TuitionType } from "@/lib/generated/prisma/enums";
import { LISTED_SCHOLARSHIP } from "@/lib/scholarships/listed";

/**
 * Catalogue URL parsing and query building (docs/ui-remodel.md §9.6).
 *
 * The keys and their meanings are a contract: bookmarked and shared links
 * from before the remodel must filter identically (q, country, degree,
 * field, tuition, sort, coverage, verified, has, page). New keys (qualify,
 * view, focus) are additive. Kept pure so a test can prove it.
 */

export type SearchParamsRecord = Record<string, string | string[] | undefined>;

const str = (v: string | string[] | undefined): string | undefined => (typeof v === "string" && v !== "" ? v : undefined);

export function parsePageParam(v: string | string[] | undefined): number {
  const n = Number(typeof v === "string" ? v : "1");
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
}

// ---------------------------------------------------------------------------
// Programmes
// ---------------------------------------------------------------------------

export interface ProgrammeFilters {
  q?: string;
  country?: string;
  degree?: string;
  field?: string;
  tuition?: string;
  /** "match" (default; "best" is an alias), "name" or "tuition". Anything else sorts by name, as before. */
  sort: "match" | "name" | "tuition";
  qualify: boolean;
  view: "posters" | "list";
  page: number;
}

export function parseProgrammeParams(params: SearchParamsRecord): ProgrammeFilters {
  const rawSort = str(params.sort) ?? "match";
  const sort = rawSort === "match" || rawSort === "best" ? "match" : rawSort === "tuition" ? "tuition" : "name";
  return {
    q: str(params.q),
    country: str(params.country),
    degree: str(params.degree),
    field: str(params.field),
    tuition: str(params.tuition),
    sort,
    qualify: params.qualify === "1",
    view: params.view === "list" ? "list" : "posters",
    page: parsePageParam(params.page),
  };
}

export function programmeWhere(
  f: Pick<ProgrammeFilters, "q" | "country" | "degree" | "field" | "tuition">,
  opts: { onlyIds?: string[] } = {},
): Prisma.ProgramWhereInput {
  return {
    ...(f.q
      ? {
          OR: [
            { name: { contains: f.q, mode: "insensitive" } },
            { university: { name: { contains: f.q, mode: "insensitive" } } },
          ],
        }
      : {}),
    ...(f.country ? { university: { country: f.country } } : {}),
    ...(f.degree ? { degreeLevel: f.degree as DegreeLevel } : {}),
    ...(f.field ? { fieldCategory: f.field as FieldCategory } : {}),
    ...(f.tuition ? { tuitionType: f.tuition as TuitionType } : {}),
    ...(opts.onlyIds ? { id: { in: opts.onlyIds } } : {}),
  };
}

export function programmeOrderBy(sort: ProgrammeFilters["sort"]): Prisma.ProgramOrderByWithRelationInput {
  return sort === "tuition" ? { tuitionAmount: "asc" } : { name: "asc" };
}

// ---------------------------------------------------------------------------
// Scholarships
// ---------------------------------------------------------------------------

export interface ScholarshipFilters {
  q?: string;
  country?: string;
  coverage?: string;
  verifiedOnly: boolean;
  qualify: boolean;
  view: "posters" | "list";
  page: number;
}

export function parseScholarshipParams(params: SearchParamsRecord): ScholarshipFilters {
  return {
    q: str(params.q),
    country: str(params.country),
    coverage: str(params.coverage),
    verifiedOnly: params.verified === "true",
    qualify: params.qualify === "1",
    view: params.view === "list" ? "list" : "posters",
    page: parsePageParam(params.page),
  };
}

export function scholarshipWhere(
  f: Pick<ScholarshipFilters, "q" | "country" | "coverage" | "verifiedOnly">,
  opts: { onlyIds?: string[] } = {},
): Prisma.ScholarshipWhereInput {
  return {
    ...LISTED_SCHOLARSHIP,
    ...(f.q
      ? {
          OR: [
            { name: { contains: f.q, mode: "insensitive" } },
            { providerName: { contains: f.q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(f.country ? { country: f.country } : {}),
    ...(f.coverage ? { coverageType: f.coverage as ScholarshipCoverageType } : {}),
    ...(f.verifiedOnly ? { verified: true } : {}),
    ...(opts.onlyIds ? { id: { in: opts.onlyIds } } : {}),
  };
}

// ---------------------------------------------------------------------------
// Universities
// ---------------------------------------------------------------------------

export interface UniversityFilters {
  q?: string;
  country?: string;
  has?: string;
  sort: "scholarships" | "programs" | "name";
  page: number;
}

export function parseUniversityParams(params: SearchParamsRecord): UniversityFilters {
  const rawSort = str(params.sort) ?? "scholarships";
  return {
    q: str(params.q),
    country: str(params.country),
    has: str(params.has),
    sort: rawSort === "name" ? "name" : rawSort === "programs" ? "programs" : "scholarships",
    page: parsePageParam(params.page),
  };
}

export function universityWhere(f: Pick<UniversityFilters, "q" | "country" | "has">): Prisma.UniversityWhereInput {
  return {
    ...(f.q
      ? {
          OR: [
            { name: { contains: f.q, mode: "insensitive" } },
            { city: { contains: f.q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(f.country ? { country: f.country } : {}),
    ...(f.has === "programs" ? { programs: { some: {} } } : {}),
    ...(f.has === "scholarships" ? { fundingOpportunities: { some: {} } } : {}),
  };
}

export function universityOrderBy(sort: UniversityFilters["sort"]): Prisma.UniversityOrderByWithRelationInput {
  return sort === "name"
    ? { name: "asc" }
    : sort === "programs"
      ? { programs: { _count: "desc" } }
      : { fundingOpportunities: { _count: "desc" } };
}

/** The query string for a URL with one key changed (page always reset). */
export function withParam(params: SearchParamsRecord, key: string, value: string | null): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (k === "page" || k === "focus" || v === undefined) continue;
    if (Array.isArray(v)) v.forEach((x) => search.append(k, x));
    else search.set(k, v);
  }
  if (value === null || value === "") search.delete(key);
  else search.set(key, value);
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}
