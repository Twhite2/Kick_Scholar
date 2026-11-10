import Link from "next/link";
import { CircleAlert, TrendingUp } from "lucide-react";
import type { OneAwayItem } from "@/lib/types/cards";
import { InstitutionLogo } from "./institution-logo";

/** "Close one gap and this becomes a strong match" (docs/ui-remodel.md §9.1.6). */
export function OneAwayCard({ item }: { item: OneAwayItem }) {
  const inst = item.institution;
  return (
    <article className="relative flex w-[300px] flex-col gap-3 rounded-tile bg-white p-[18px] shadow-hairline md:w-[360px]">
      <div className="flex min-w-0 items-center gap-3">
        {inst && (
          <InstitutionLogo name={inst.name} logoUrl={inst.logoUrl} acronym={inst.acronym} seed={inst.id} size={44} />
        )}
        <div className="min-w-0">
          <h3 className="type-card-title clamp-2 text-ink">
            <Link
              href={item.href}
              className="before:absolute before:inset-0 before:rounded-tile before:content-[''] hover:text-kick-blue"
            >
              {item.title}
            </Link>
          </h3>
          <p className="truncate type-meta text-ink-3">{item.organisation}</p>
        </div>
      </div>
      <div className="flex gap-2.5 rounded-xl bg-red-tint px-3 py-2.5">
        <CircleAlert aria-hidden="true" className="mt-px size-[18px] shrink-0 text-kick-red" />
        <p className="text-sm leading-[1.4] text-red-deep">
          <span className="sr-only">Gap: </span>
          {item.gap}
        </p>
      </div>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
        {item.to !== null && (
          <p className="flex items-center gap-1.5 text-sm font-bold text-green-text tabular-nums">
            <TrendingUp aria-hidden="true" className="size-4 shrink-0 text-kick-green" />
            Match rises from {item.from} to {item.to}
          </p>
        )}
        {item.action && (
          <Link
            href={item.action.href}
            className="relative z-10 inline-flex h-11 items-center rounded-full border border-line-strong bg-white px-4 text-[15px] font-bold text-ink hover:border-kick-blue hover:text-kick-blue"
          >
            {item.action.label}
          </Link>
        )}
      </div>
    </article>
  );
}
