"use client";

import { Children, useState } from "react";
import { cn } from "@/lib/utils";

/** Shows the first `initial` items, then "Show all {n}" reveals the rest. */
export function ExpandableGrid({
  initial = 12,
  className,
  noun = "",
  children,
}: {
  initial?: number;
  className?: string;
  noun?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const items = Children.toArray(children);
  const hidden = items.length - initial;
  return (
    <div>
      <ul role="list" className={cn("grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]", className)}>
        {items.map((child, i) => (
          <li key={i} hidden={!open && i >= initial}>
            {child}
          </li>
        ))}
      </ul>
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="mt-4 inline-flex h-11 items-center rounded-full border border-line-strong bg-white px-5 text-[15px] font-bold text-ink hover:border-kick-blue hover:text-kick-blue"
        >
          {open ? "Show fewer" : `Show all ${items.length}${noun ? ` ${noun}` : ""}`}
        </button>
      )}
    </div>
  );
}
