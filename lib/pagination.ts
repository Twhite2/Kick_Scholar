export const PAGE_SIZE = 24;

/** 1-based page number from a search param; anything invalid is page 1. */
export function parsePage(value: string | string[] | undefined): number {
  const n = typeof value === "string" ? Number.parseInt(value, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/**
 * One page of a "best match first" listing without loading the catalogue.
 *
 * Match scores live in their own table, so the database can't order the
 * catalogue by them directly. The order is: every matched id (already sorted
 * by score), then everything unmatched in its default order. This slices that
 * virtual list, fetching only the rows that fall on the requested page.
 */
export async function pageByMatch<T extends { id: string }>(opts: {
  matchedIds: string[];
  page: number;
  fetchByIds: (ids: string[]) => Promise<T[]>;
  fetchUnmatched: (excludeIds: string[], skip: number, take: number) => Promise<T[]>;
}): Promise<T[]> {
  const { matchedIds, page, fetchByIds, fetchUnmatched } = opts;
  const start = (page - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;

  const pageMatchedIds = matchedIds.slice(start, end);
  const matched = pageMatchedIds.length ? await fetchByIds(pageMatchedIds) : [];
  const byId = new Map(matched.map((r) => [r.id, r]));
  const ordered = pageMatchedIds.flatMap((id) => byId.get(id) ?? []);

  const remaining = PAGE_SIZE - ordered.length;
  if (remaining <= 0) return ordered;
  const unmatchedSkip = Math.max(0, start - matchedIds.length);
  return [...ordered, ...(await fetchUnmatched(matchedIds, unmatchedSkip, remaining))];
}
