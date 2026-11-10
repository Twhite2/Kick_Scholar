"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * The Home billboard's pager (docs/ui-remodel.md §9.1.1). Never rotates on
 * its own; the student pages with the three bars. Slides are rendered on
 * the server and only shown or hidden here.
 */
export function Billboard({
  slides,
  labels,
  className,
}: {
  slides: React.ReactNode[];
  /** "MSc in Data Science, RWTH Aachen University" — read out on change. */
  labels: string[];
  className?: string;
}) {
  const [current, setCurrent] = useState(0);
  const [announce, setAnnounce] = useState("");
  const total = slides.length;

  function show(i: number) {
    setCurrent(i);
    setAnnounce(`Showing top match ${i + 1} of ${total}: ${labels[i] ?? ""}`);
  }

  return (
    <section aria-label="Your top matches" className={cn("relative overflow-hidden bg-night", className)}>
      {slides.map((slide, i) => (
        <div key={i} hidden={i !== current}>
          {slide}
        </div>
      ))}
      {total > 1 && (
        <div className="absolute right-[var(--gutter)] bottom-[92px] z-20 flex items-center gap-2">
          <span className="mr-1 text-sm text-on-night-muted tabular-nums">
            Top match {current + 1} of {total}
          </span>
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Show top match ${i + 1}`}
              aria-current={i === current ? "true" : undefined}
              onClick={() => show(i)}
              className="group/bar inline-flex size-11 items-center justify-center"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "h-1 rounded-full transition-[width,background-color] duration-200",
                  i === current ? "w-9 bg-white" : "w-[18px] bg-white/40 group-hover/bar:bg-white/70",
                )}
              />
            </button>
          ))}
        </div>
      )}
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
    </section>
  );
}
