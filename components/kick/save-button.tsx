"use client";

import { useState, useTransition } from "react";
import { Bookmark } from "lucide-react";
import { toggleSavedProgram, toggleSavedScholarship } from "@/lib/actions/saved";
import { cn } from "@/lib/utils";

/**
 * Save toggle (docs/ui-remodel.md §8). Optimistic: flips instantly and
 * reverts if the server says no. Icon-only variants keep a constant label
 * and report state with aria-pressed; the night variant shows the state in
 * its visible text instead.
 */
export function SaveButton({
  targetType,
  targetId,
  title,
  initialSaved,
  variant = "outline",
  className,
}: {
  targetType: "program" | "scholarship";
  targetId: string;
  title: string;
  initialSaved: boolean;
  variant?: "onImage" | "outline" | "night";
  className?: string;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [pops, setPops] = useState(0);
  const [isPending, startTransition] = useTransition();

  function toggle() {
    const next = !saved;
    setSaved(next); // optimistic
    if (next) setPops((n) => n + 1);
    startTransition(async () => {
      const action = targetType === "program" ? toggleSavedProgram : toggleSavedScholarship;
      const result = await action(targetId);
      if ("error" in result) setSaved(!next); // revert on failure
    });
  }

  const icon = (
    <Bookmark
      key={pops}
      aria-hidden="true"
      className={cn("size-[18px]", pops > 0 && saved && "ks-pop", saved && "fill-current")}
    />
  );

  if (variant === "night") {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={isPending}
        className={cn(
          "inline-flex h-[52px] items-center gap-2 rounded-full border border-white/40 px-6 text-base font-bold text-white transition-colors hover:bg-white/10 disabled:opacity-70",
          className,
        )}
      >
        {icon}
        {saved ? "Saved" : "Save"}
      </button>
    );
  }

  if (variant === "onImage") {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={isPending}
        aria-pressed={saved}
        aria-label={`Save ${title}`}
        className={cn("group/save inline-flex size-11 items-center justify-center rounded-full", className)}
      >
        <span
          className={cn(
            "inline-flex size-9 items-center justify-center rounded-full bg-white shadow-tile-on-image transition-colors",
            saved ? "text-kick-blue" : "text-ink group-hover/save:text-kick-blue",
          )}
        >
          {icon}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      aria-pressed={saved}
      aria-label={`Save ${title}`}
      className={cn(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-line-strong bg-white transition-colors hover:border-kick-blue",
        saved ? "text-kick-blue" : "text-ink",
        className,
      )}
    >
      {icon}
    </button>
  );
}
