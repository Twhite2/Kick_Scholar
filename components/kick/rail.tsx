"use client";

import { Children, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A horizontal rail (docs/ui-remodel.md §9.1.4): heading, optional "See
 * all", and prev/next buttons that page by roughly one screen. The track
 * scrolls by touch, trackpad and keyboard with the scrollbar hidden; the
 * buttons are hidden on touch devices and disabled at either end.
 */
export function Rail({
  id,
  title,
  pill,
  description,
  seeAll,
  prevLabel,
  nextLabel,
  gap = 20,
  stretch = false,
  className,
  children,
}: {
  id: string;
  title: React.ReactNode;
  pill?: React.ReactNode;
  description?: React.ReactNode;
  seeAll?: { href: string; label: string } | null;
  prevLabel: string;
  nextLabel: string;
  gap?: number;
  /** Stretch every card to the tallest (one-away cards). */
  stretch?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const track = useRef<HTMLUListElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const items = Children.toArray(children);

  const update = useCallback(() => {
    const el = track.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 2);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [update]);

  function page(direction: 1 | -1) {
    const el = track.current;
    if (!el) return;
    const first = el.querySelector<HTMLElement>(":scope > li");
    const card = first?.offsetWidth ?? 280;
    const distance = Math.max(card, el.clientWidth - card);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: direction * distance, behavior: reduce ? "auto" : "smooth" });
  }

  if (items.length === 0) return null;

  const headingId = `${id}-heading`;
  const navButton =
    "inline-flex size-11 items-center justify-center rounded-full border border-line-strong bg-white text-ink transition-colors hover:border-kick-blue hover:text-kick-blue disabled:cursor-default disabled:opacity-40 disabled:hover:border-line-strong disabled:hover:text-ink [@media(hover:none)]:hidden";

  return (
    <section aria-labelledby={headingId} className={cn("relative", className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 px-gutter">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h2 id={headingId} className="type-section-h2 text-ink">
              {title}
            </h2>
            {pill}
          </div>
          {description && <p className="mt-1.5 type-body-sm text-ink-3">{description}</p>}
        </div>
        <div className="flex items-center gap-3">
          {seeAll && (
            <Link
              href={seeAll.href}
              className="inline-flex min-h-11 items-center text-[15px] font-bold text-kick-blue hover:underline"
            >
              {seeAll.label}
            </Link>
          )}
          <button type="button" className={navButton} aria-label={prevLabel} disabled={atStart} onClick={() => page(-1)}>
            <ChevronLeft aria-hidden="true" className="size-5" />
          </button>
          <button type="button" className={navButton} aria-label={nextLabel} disabled={atEnd} onClick={() => page(1)}>
            <ChevronRight aria-hidden="true" className="size-5" />
          </button>
        </div>
      </div>
      <ul
        ref={track}
        role="list"
        className={cn(
          "mt-4 flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain px-gutter pt-1 pb-7 scrollbar-none",
          stretch ? "items-stretch" : "items-start",
        )}
        style={{ gap, scrollPaddingInlineStart: "var(--gutter)" }}
      >
        {items.map((child, i) => (
          <li key={i} className={cn("flex-none snap-start", stretch && "flex")}>
            {child}
          </li>
        ))}
      </ul>
    </section>
  );
}
