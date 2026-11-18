import type { PrismaClient } from "@/lib/generated/prisma/client";
import { programmeWhere, scholarshipWhere, universityWhere } from "@/lib/catalogue/params";
import { countryName } from "@/lib/ui/country";
import { degreeLabel } from "@/lib/ui/requirements";
import { MAX_QUERY, type Suggestions } from "./shared";

/**
 * Suggestions for the search field in the top bar. Each group uses the same
 * filter as its catalogue page, so "See all 128 programmes" lands on exactly
 * those 128, and an unlisted scholarship never appears.
 */

const SHOWN = { programmes: 5, universities: 3, scholarships: 3 } as const;

/** Lower case without accents, for comparing names when ranking. */
const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * How well a name matches the query: 0 exact, 1 starts with it, 2 a word
 * starts with it, 3 contains it, 4 matched on something else (the
 * university's name, the city, the provider).
 */
export function matchRank(name: string, q: string): number {
  const n = fold(name);
  const t = fold(q.trim());
  if (!t) return 4;
  if (n === t) return 0;
  if (n.startsWith(t)) return 1;
  if (new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(t)}`, "u").test(n)) return 2;
  if (n.includes(t)) return 3;
  return 4;
}

/** Best match first; among equals, the shorter name, then A to Z. */
export function rankByName<T extends { name: string }>(rows: T[], q: string, limit: number): T[] {
  const seen = new Set<string>();
  return rows
    .filter((r) => {
      const key = (r as { id?: string }).id ?? r.name;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((r) => ({ r, rank: matchRank(r.name, q) }))
    .sort((a, b) => a.rank - b.rank || a.r.name.length - b.r.name.length || a.r.name.localeCompare(b.r.name))
    .slice(0, limit)
    .map(({ r }) => r);
}

const place = (city: string | null, country: string | null) =>
  [city, country ? countryName(country) : null].filter(Boolean).join(", ");

export async function searchSuggestions(prisma: PrismaClient, raw: string): Promise<Suggestions> {
  const q = raw.trim().slice(0, MAX_QUERY);
  const qs = `?q=${encodeURIComponent(q)}`;
  const startsWith = { startsWith: q, mode: "insensitive" as const };

  // Names that start with the query are fetched on their own: an A-to-Z
  // page of "contains" matches would often miss them.
  const programmeFilter = programmeWhere({ q });
  const programmeSelect = {
    id: true,
    name: true,
    degreeLevel: true,
    university: { select: { name: true, country: true } },
  } as const;
  const universityFilter = universityWhere({ q });
  const universitySelect = { id: true, name: true, city: true, country: true } as const;
  const scholarshipFilter = scholarshipWhere({ q, verifiedOnly: false });
  const scholarshipSelect = { id: true, name: true, providerName: true, country: true } as const;

  const [pTotal, pFirst, pMore, uTotal, uFirst, uMore, sTotal, sFirst, sMore] = await Promise.all([
    prisma.program.count({ where: programmeFilter }),
    prisma.program.findMany({ where: { name: startsWith }, select: programmeSelect, orderBy: { name: "asc" }, take: 10 }),
    prisma.program.findMany({ where: programmeFilter, select: programmeSelect, orderBy: { name: "asc" }, take: 25 }),
    prisma.university.count({ where: universityFilter }),
    prisma.university.findMany({ where: { name: startsWith }, select: universitySelect, orderBy: { name: "asc" }, take: 10 }),
    prisma.university.findMany({ where: universityFilter, select: universitySelect, orderBy: { name: "asc" }, take: 25 }),
    prisma.scholarship.count({ where: scholarshipFilter }),
    prisma.scholarship.findMany({
      where: { AND: [scholarshipFilter, { name: startsWith }] },
      select: scholarshipSelect,
      orderBy: { name: "asc" },
      take: 10,
    }),
    prisma.scholarship.findMany({ where: scholarshipFilter, select: scholarshipSelect, orderBy: { name: "asc" }, take: 25 }),
  ]);

  return {
    q,
    programmes: {
      total: pTotal,
      href: `/programs${qs}`,
      items: rankByName([...pFirst, ...pMore], q, SHOWN.programmes).map((p) => ({
        id: p.id,
        name: p.name,
        detail: [degreeLabel(p.degreeLevel), place(p.university.name, p.university.country)].filter(Boolean).join(" · "),
        country: p.university.country,
        href: `/programs/${p.id}`,
      })),
    },
    universities: {
      total: uTotal,
      href: `/institutions${qs}`,
      items: rankByName([...uFirst, ...uMore], q, SHOWN.universities).map((u) => ({
        id: u.id,
        name: u.name,
        detail: place(u.city, u.country),
        country: u.country,
        href: `/institutions/${u.id}`,
      })),
    },
    scholarships: {
      total: sTotal,
      href: `/scholarships${qs}`,
      items: rankByName([...sFirst, ...sMore], q, SHOWN.scholarships).map((s) => ({
        id: s.id,
        name: s.name,
        detail: [s.providerName, s.country ? countryName(s.country) : null].filter(Boolean).join(" · "),
        country: s.country,
        href: `/scholarships/${s.id}`,
      })),
    },
  };
}
