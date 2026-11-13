import Link from "next/link";
import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";
import { EXPLORE } from "@/lib/ui/nav";
import { withParam, type SearchParamsRecord } from "@/lib/catalogue/params";

/** Programmes | Scholarships | Universities, on phones only (§7.2). */
export function ExploreSwitcher({ current }: { current: (typeof EXPLORE)[number]["href"] }) {
  return (
    <nav aria-label="Explore" className="px-gutter pt-4 md:hidden">
      <ul className="grid grid-cols-3 rounded-full bg-grey-tint p-1">
        {EXPLORE.map((item) => {
          const active = item.href === current;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-10 items-center justify-center rounded-full text-sm font-bold",
                  active ? "bg-white text-kick-blue shadow-hairline" : "text-slate",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Page H1 and the result sentence. */
export function CatalogueHeader({ title, summary }: { title: string; summary: string }) {
  return (
    <div className="px-gutter pt-6 md:pt-10">
      <h1 className="type-page-h1 text-ink">{title}</h1>
      <p className="mt-2 type-body-sm text-ink-3 tabular-nums">{summary}</p>
    </div>
  );
}

/** Posters | List (§9.6). Links, so it works before any JavaScript loads. */
export function ViewToggle({ params, pathname }: { params: SearchParamsRecord; pathname: string }) {
  const list = params.view === "list";
  const item = "inline-flex h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-bold";
  return (
    <div role="group" aria-label="View" className="inline-flex rounded-full bg-grey-tint p-0.5">
      <Link
        href={`${pathname}${withParam(params, "view", null)}`}
        aria-current={!list ? "true" : undefined}
        scroll={false}
        className={cn(item, !list ? "bg-white text-kick-blue shadow-hairline" : "text-slate hover:text-ink")}
      >
        <LayoutGrid aria-hidden="true" className="size-4" /> Posters
      </Link>
      <Link
        href={`${pathname}${withParam(params, "view", "list")}`}
        aria-current={list ? "true" : undefined}
        scroll={false}
        className={cn(item, list ? "bg-white text-kick-blue shadow-hairline" : "text-slate hover:text-ink")}
      >
        <List aria-hidden="true" className="size-4" /> List
      </Link>
    </div>
  );
}

/** Empty results: the sentence plus a way out. */
export function EmptyResults({ message, clearHref }: { message: string; clearHref: string }) {
  return (
    <div className="mx-gutter rounded-panel border border-dashed border-line-strong bg-white px-6 py-12 text-center">
      <p className="text-base text-ink-2">{message}</p>
      <Link
        href={clearHref}
        className="mt-4 inline-flex h-11 items-center rounded-full border border-line-strong bg-white px-5 text-[15px] font-bold text-ink hover:border-kick-blue hover:text-kick-blue"
      >
        Clear filters
      </Link>
    </div>
  );
}
