import Link from "next/link";
import { Coins } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScholarshipCardData } from "@/lib/types/cards";
import { COVERAGE_LABEL, POSTER_BAND_BG, posterAmount, posterBand } from "@/lib/ui/coverage";
import { closesIn, daysUntil, formatDate, isUrgent } from "@/lib/ui/format";
import { providerFace } from "@/lib/cards/faces";
import { InstitutionLogo } from "./institution-logo";
import { SaveButton } from "./save-button";
import { SourceBadge } from "./badges";

/** Banknote-style rosette, kept faint (Appendix A.6). */
export function Rosette({ className, size = 240 }: { className?: string; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 240 240"
      fill="none"
      stroke="#FFFFFF"
      strokeWidth={1}
      className={cn("pointer-events-none absolute opacity-[.16]", className)}
    >
      <ellipse cx="120" cy="120" rx="112" ry="40" />
      <ellipse cx="120" cy="120" rx="112" ry="40" transform="rotate(30 120 120)" />
      <ellipse cx="120" cy="120" rx="112" ry="40" transform="rotate(60 120 120)" />
      <ellipse cx="120" cy="120" rx="112" ry="40" transform="rotate(90 120 120)" />
      <ellipse cx="120" cy="120" rx="112" ry="40" transform="rotate(120 120 120)" />
      <ellipse cx="120" cy="120" rx="112" ry="40" transform="rotate(150 120 120)" />
      <circle cx="120" cy="120" r="28" />
    </svg>
  );
}

export function scholarshipDeadlineText(card: Pick<ScholarshipCardData, "nextDeadline" | "deadlineText">, now: Date): string {
  if (card.nextDeadline) {
    const days = daysUntil(card.nextDeadline, now);
    return days <= 14 ? closesIn(days) : `Closes ${formatDate(card.nextDeadline, now)}`;
  }
  // Long deadline prose doesn't fit a poster; point to the details instead.
  if (card.deadlineText) return card.deadlineText.length <= 24 ? card.deadlineText : "See deadline details";
  return "Check with provider";
}

/**
 * A scholarship as a money poster (docs/ui-remodel.md §9.1.6). The band
 * colour says what kind of funding it is; the amount is only what the record
 * states.
 */
export function FundingPoster({
  card,
  mode = "rail",
  now = new Date(),
}: {
  card: ScholarshipCardData;
  /** rail: 272 × 340 (220 × 316 on phones). grid: fluid. compact: detail pages, 120px band. */
  mode?: "rail" | "grid" | "compact";
  now?: Date;
}) {
  const band = posterBand(card.coverage);
  const amount = posterAmount({ coverage: card.coverage, amount: card.amount?.value ?? null, currency: card.amount?.currency ?? null, per: card.amount?.per ?? null });
  const face = card.provider.institution ?? providerFace(card.provider.name);
  const compact = mode === "compact";
  const deadline = scholarshipDeadlineText(card, now);
  const urgent = card.nextDeadline ? isUrgent(daysUntil(card.nextDeadline, now)) : false;

  return (
    <article
      className={cn(
        "group/fund relative flex flex-col rounded-poster bg-white shadow-hairline transition-shadow can-hover:hover:shadow-preview",
        mode === "rail" && "h-[316px] w-[220px] md:h-[340px] md:w-[272px]",
        mode === "grid" && "h-[316px] w-full md:h-[340px]",
        compact && "w-full",
      )}
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-t-poster px-[18px] py-4 text-white",
          POSTER_BAND_BG[band],
          compact ? "h-[120px]" : "h-[150px] md:h-[176px]",
        )}
      >
        <Rosette className="-top-[70px] -right-[78px]" />
        <p className="flex items-center gap-1.5 type-caption">
          <Coins aria-hidden="true" className="size-4" />
          {COVERAGE_LABEL[card.coverage]}
        </p>
        {/* The compact band is 120px with the logo at 97px: "a month" sits
            beside the amount there instead of below it. */}
        <div className={cn("mt-2.5 md:mt-3", compact && "flex flex-wrap items-baseline gap-x-2")}>
          <p
            className={cn("font-display leading-none font-[750] tracking-[-0.03em] tabular-nums", !amount.confirmed && "text-[24px] md:text-[30px]")}
            style={amount.confirmed ? { fontSize: compact ? Math.min(amount.size, 38) : amount.size } : undefined}
          >
            {amount.text}
          </p>
          {amount.per && <p className={cn("text-sm text-white/[.88]", !compact && "mt-1.5")}>{amount.per}</p>}
        </div>
      </div>
      <div className="absolute top-1.5 right-1.5 z-10">
        <SaveButton targetType="scholarship" targetId={card.id} title={card.title} initialSaved={card.saved} variant="onImage" />
      </div>
      <InstitutionLogo
        name={face.name}
        logoUrl={face.logoUrl}
        acronym={face.acronym}
        seed={face.id}
        size={46}
        surface="image"
        className={cn(
          "pointer-events-none absolute left-4 z-10",
          compact ? "top-[97px]" : "top-[127px] md:top-[153px]",
        )}
      />
      <div className={cn("flex flex-1 flex-col gap-1 px-4 pb-4", compact ? "pt-8" : "pt-8")}>
        <h3 className="type-card-title clamp-2 text-ink">
          <Link
            href={`/scholarships/${card.id}`}
            className="before:absolute before:inset-0 before:z-0 before:rounded-poster before:content-[''] hover:text-kick-blue"
          >
            {card.title}
          </Link>
        </h3>
        <p className="truncate type-meta text-ink-3">{card.provider.name}</p>
        <div className={cn("flex flex-wrap items-center justify-between gap-2", compact ? "mt-3" : "mt-auto")}>
          <SourceBadge verified={card.sourceVerified} className="relative z-10" />
          <span className={cn("text-[13px]", urgent ? "font-bold text-kick-red" : "text-ink-3")}>{deadline}</span>
        </div>
      </div>
    </article>
  );
}
