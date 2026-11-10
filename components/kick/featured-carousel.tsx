"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Phones get a swipeable row of up to three featured cards instead of the
 * billboard (docs/ui-remodel.md §9.1.8), with a peek of the next card and
 * dots that also work as buttons.
 */
export function FeaturedCarousel({ slides, labels }: { slides: React.ReactNode[]; labels: string[] }) {
  const track = useRef<HTMLUListElement>(null);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const items = Array.from(el.children) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio >= 0.6) {
            setCurrent(items.indexOf(e.target as HTMLElement));
          }
        }
      },
      { root: el, threshold: [0.6] },
    );
    items.forEach((i) => io.observe(i));
    return () => io.disconnect();
  }, [slides.length]);

  function go(i: number) {
    const el = track.current;
    const item = el?.children[i] as HTMLElement | undefined;
    if (!el || !item) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: item.offsetLeft - el.offsetLeft - parseFloat(getComputedStyle(el).paddingLeft), behavior: reduce ? "auto" : "smooth" });
  }

  return (
    <div aria-roledescription="carousel" aria-label="Your top matches">
      <ul
        ref={track}
        role="list"
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-gutter pb-2 scrollbar-none"
        style={{ scrollPaddingInlineStart: "var(--gutter)" }}
      >
        {slides.map((slide, i) => (
          <li
            key={i}
            aria-label={`${i + 1} of ${slides.length}: ${labels[i] ?? ""}`}
            className="w-[calc(100vw-2*var(--gutter)-28px)] max-w-[440px] flex-none snap-start"
          >
            {slide}
          </li>
        ))}
      </ul>
      {slides.length > 1 && (
        <div className="mt-1 flex justify-center">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Show top match ${i + 1}`}
              aria-current={i === current ? "true" : undefined}
              onClick={() => go(i)}
              className="inline-flex size-11 items-center justify-center"
            >
              <span
                aria-hidden="true"
                className={cn("size-2 rounded-full transition-colors", i === current ? "bg-white" : "bg-white/40")}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
