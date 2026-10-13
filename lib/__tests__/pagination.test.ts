import { describe, expect, it } from "vitest";
import { PAGE_SIZE, pageByMatch, parsePage } from "../pagination";

// 30 matched ids (best first) followed by 40 unmatched in name order.
const matchedIds = Array.from({ length: 30 }, (_, i) => `m${i}`);
const unmatched = Array.from({ length: 40 }, (_, i) => ({ id: `u${i}` }));

const run = (page: number) =>
  pageByMatch({
    matchedIds,
    page,
    // Return out of order, as `WHERE id IN (...)` does.
    fetchByIds: async (ids) => [...ids].reverse().map((id) => ({ id })),
    fetchUnmatched: async (exclude, skip, take) =>
      unmatched.filter((u) => !exclude.includes(u.id)).slice(skip, skip + take),
  });

describe("pageByMatch", () => {
  it("serves matched rows first, in score order", async () => {
    const rows = await run(1);
    expect(rows.map((r) => r.id)).toEqual(matchedIds.slice(0, PAGE_SIZE));
  });

  it("fills the page that straddles the boundary with unmatched rows", async () => {
    const rows = await run(2);
    expect(rows.map((r) => r.id)).toEqual([
      ...matchedIds.slice(PAGE_SIZE),
      ...unmatched.slice(0, PAGE_SIZE - (30 - PAGE_SIZE)).map((u) => u.id),
    ]);
  });

  it("continues unmatched rows without skipping or repeating any", async () => {
    const all = [...(await run(1)), ...(await run(2)), ...(await run(3))].map((r) => r.id);
    expect(new Set(all).size).toBe(70);
    expect(all).toHaveLength(70);
  });
});

describe("parsePage", () => {
  it("falls back to page 1 for junk", () => {
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage("0")).toBe(1);
    expect(parsePage("abc")).toBe(1);
    expect(parsePage("3")).toBe(3);
  });
});
