import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Page navigation that preserves the filters already in the URL.
 *
 * Server-rendered plain links rather than a client component: the list it
 * pages through is server-rendered too, so there is no state to hold and
 * nothing to hydrate.
 */

export type SearchParamsRecord = Record<string, string | string[] | undefined>;

/** Rebuilds the current query string with a different page number. */
function hrefForPage(
  basePath: string,
  params: SearchParamsRecord,
  page: number,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "page" || value === undefined) continue;
    if (Array.isArray(value)) value.forEach((v) => search.append(key, v));
    else search.set(key, value);
  }
  // Page 1 is the default, so leave it out and keep the canonical URL clean.
  if (page > 1) search.set("page", String(page));
  const qs = search.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/**
 * Page numbers to show: always the first and last, plus a window around the
 * current page, with gaps marked. Rendering all of them is exactly the problem
 * pagination exists to solve.
 */
function pageWindow(current: number, total: number): Array<number | "gap"> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: Array<number | "gap"> = [];
  let previous = 0;
  for (const p of sorted) {
    if (previous && p - previous > 1) out.push("gap");
    out.push(p);
    previous = p;
  }
  return out;
}

export function Pagination({
  basePath,
  params,
  page,
  totalPages,
}: {
  basePath: string;
  params: SearchParamsRecord;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;

  // 44px pills; the current page is Kick Blue (docs/ui-remodel.md §9.6).
  const linkClass =
    "inline-flex h-11 min-w-11 items-center justify-center rounded-full border border-line-strong bg-white px-4 text-[15px] font-bold text-ink tabular-nums transition-colors hover:border-kick-blue hover:text-kick-blue";
  const disabledClass =
    "inline-flex h-11 min-w-11 items-center justify-center rounded-full border border-line px-4 text-[15px] font-bold text-ink-3 opacity-60";

  return (
    <nav className="flex flex-wrap items-center justify-center gap-2" aria-label="Pagination">
      {page > 1 ? (
        <Link href={hrefForPage(basePath, params, page - 1)} className={linkClass} rel="prev">
          <ChevronLeft className="size-4" />
          <span className="ml-1">Previous</span>
        </Link>
      ) : (
        <span className={disabledClass} aria-disabled="true">
          <ChevronLeft className="size-4" />
          <span className="ml-1">Previous</span>
        </span>
      )}

      {pageWindow(page, totalPages).map((entry, i) =>
        entry === "gap" ? (
          <span key={`gap-${i}`} aria-hidden="true" className="px-1 text-ink-3">
            …
          </span>
        ) : (
          <Link
            key={entry}
            href={hrefForPage(basePath, params, entry)}
            aria-current={entry === page ? "page" : undefined}
            className={cn(
              linkClass,
              entry === page && "border-kick-blue bg-kick-blue text-white hover:bg-kick-blue hover:text-white",
            )}
          >
            {entry}
          </Link>
        ),
      )}

      {page < totalPages ? (
        <Link href={hrefForPage(basePath, params, page + 1)} className={linkClass} rel="next">
          <span className="mr-1">Next</span>
          <ChevronRight className="size-4" />
        </Link>
      ) : (
        <span className={disabledClass} aria-disabled="true">
          <span className="mr-1">Next</span>
          <ChevronRight className="size-4" />
        </span>
      )}
    </nav>
  );
}
