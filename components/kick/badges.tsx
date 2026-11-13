import { CircleAlert, CircleCheck, Globe, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { STRENGTH_BADGE_CLASS, STRENGTH_LABEL, type Strength } from "@/lib/ui/strength";

const PILL = "inline-flex h-7 w-fit shrink-0 items-center gap-1.5 rounded-full px-2.5 type-caption whitespace-nowrap";

/**
 * "Verified source" vs "Needs verification" (§6.5). Trust-critical: an
 * aggregator find is never presented like an official page.
 */
export function SourceBadge({
  verified,
  tone = "light",
  className,
}: {
  verified: boolean;
  tone?: "light" | "night";
  className?: string;
}) {
  if (verified) {
    return (
      <span
        className={cn(
          PILL,
          tone === "night" ? "bg-[rgba(111,211,155,.16)] text-[#A6EBC4]" : "bg-green-tint text-green-text",
          className,
        )}
      >
        <ShieldCheck aria-hidden="true" className="size-3.5" />
        Verified source
      </span>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            tabIndex={0}
            className={cn(
              PILL,
              "cursor-help",
              tone === "night" ? "bg-white/10 text-[#E3EBF4]" : "bg-grey-tint text-slate",
              className,
            )}
          />
        }
      >
        <Globe aria-hidden="true" className="size-3.5" />
        Needs verification
        <span className="sr-only">
          : found on a third-party site and not yet checked against the official page.
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-64 bg-ink text-[13px] leading-snug text-white">
        Found on a third-party site and not yet checked against the official page.
      </TooltipContent>
    </Tooltip>
  );
}

/** Per-requirement verification on detail pages. */
export function RequirementBadge({ verified, className }: { verified: boolean; className?: string }) {
  return verified ? (
    <span className={cn(PILL, "bg-green-tint text-green-text", className)}>
      <CircleCheck aria-hidden="true" className="size-3.5" />
      Verified
    </span>
  ) : (
    <span className={cn(PILL, "border border-line-strong bg-white text-ink-3", className)}>
      <CircleAlert aria-hidden="true" className="size-3.5" />
      Unverified
    </span>
  );
}

/** The match strength in words, on a tint that passes contrast (§6.4). */
export function StrengthBadge({ strength, className }: { strength: Strength; className?: string }) {
  return <span className={cn(PILL, STRENGTH_BADGE_CLASS[strength], className)}>{STRENGTH_LABEL[strength]}</span>;
}

/** Neutral pill (degree, mode, language) for light or night surfaces. */
export function Pill({
  children,
  tone = "light",
  className,
}: {
  children: React.ReactNode;
  tone?: "light" | "night" | "blue";
  className?: string;
}) {
  return (
    <span
      className={cn(
        PILL,
        tone === "night" && "bg-white/10 text-[#E3EBF4]",
        tone === "light" && "bg-grey-tint text-slate",
        tone === "blue" && "bg-blue-tint text-kick-blue",
        className,
      )}
    >
      {children}
    </span>
  );
}
