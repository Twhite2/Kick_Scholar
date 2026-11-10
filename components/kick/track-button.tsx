"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ClipboardList } from "lucide-react";
import { startApplication } from "@/lib/actions/applications";
import { cn } from "@/lib/utils";

/**
 * Start tracking an application from wherever the student is (§9.3). The
 * server action seeds the document checklist; once tracking, the button
 * becomes a link to the Applications tab.
 */
export function TrackButton({
  targetType,
  targetId,
  title,
  initialTracking,
  variant = "primary",
  refreshOnTrack = false,
  onTracked,
  className,
}: {
  targetType: "PROGRAM" | "SCHOLARSHIP";
  targetId: string;
  title: string;
  initialTracking: boolean;
  variant?: "primary" | "outline" | "icon";
  /** Re-render the page after tracking, e.g. so "Your next steps" shows the checklist. */
  refreshOnTrack?: boolean;
  onTracked?: () => void;
  className?: string;
}) {
  const router = useRouter();
  const [tracking, setTracking] = useState(initialTracking);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function track() {
    setError(null);
    startTransition(async () => {
      const result = await startApplication(targetType, targetId);
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      setTracking(true);
      onTracked?.();
      if (refreshOnTrack) router.refresh();
    });
  }

  if (tracking) {
    if (variant === "icon") {
      return (
        <Link
          href="/plan?tab=applications"
          aria-label={`Tracking ${title} in My plan`}
          className={cn(
            "inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-green-tint bg-green-tint text-green-text",
            className,
          )}
        >
          <Check aria-hidden="true" className="size-[18px]" />
        </Link>
      );
    }
    return (
      <Link
        href="/plan?tab=applications"
        className={cn(
          "inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-green-tint px-5 font-bold text-green-text hover:underline",
          variant === "primary" ? "h-12 text-base" : "h-11 text-[15px]",
          className,
        )}
      >
        <Check aria-hidden="true" className="size-[18px]" />
        {variant === "primary" ? "Tracking in My plan" : "Tracking"}
      </Link>
    );
  }

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={track}
        disabled={isPending}
        aria-label={`Track ${title}`}
        className={cn(
          "inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-line-strong bg-white text-ink transition-colors hover:border-kick-blue hover:text-kick-blue disabled:opacity-60",
          className,
        )}
      >
        <ClipboardList aria-hidden="true" className="size-[18px]" />
      </button>
    );
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        onClick={track}
        disabled={isPending}
        className={cn(
          "inline-flex shrink-0 items-center justify-center gap-2 rounded-full px-5 font-bold transition-colors disabled:opacity-70",
          variant === "primary"
            ? "h-12 bg-kick-blue text-base text-white hover:bg-kick-blue-hover"
            : "h-11 border border-line-strong bg-white text-[15px] text-ink hover:border-kick-blue hover:text-kick-blue",
          className,
        )}
      >
        <ClipboardList aria-hidden="true" className="size-[18px]" />
        {isPending ? "Adding to My plan…" : variant === "primary" ? "Track this application" : "Track application"}
      </button>
      {error && (
        <span role="alert" className="text-[13px] font-bold text-kick-red">
          {error}
        </span>
      )}
    </span>
  );
}
