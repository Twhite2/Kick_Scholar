import Link from "next/link";
import { Check, CircleAlert, Clock, Coins, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProgrammeCardData } from "@/lib/types/cards";
import { countryName } from "@/lib/ui/country";
import { closesIn, daysUntil, formatDuration, isUrgent } from "@/lib/ui/format";
import { CoverImage } from "./cover-image";
import { CountryFlag } from "./country-flag";
import { InstitutionLogo } from "./institution-logo";
import { ScoreDial } from "./score-dial";
import { SaveButton } from "./save-button";
import { CompareButton } from "./compare-tray";
import { TrackButton } from "./track-button";

const POSTER_SIZES = "(min-width: 768px) 272px, 236px";
const GRID_SIZES = "(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 100vw";

/**
 * A programme as a photo poster (docs/ui-remodel.md §9.1.5). Fixed height so
 * the hover preview never shifts layout. The preview is pure CSS: it opens
 * after 250ms of hover, or when focus moves inside the card, and only on
 * precise pointers — touch taps go straight to the page.
 */
export function MatchPosterCard({
  card,
  mode = "rail",
  tracking = false,
  now = new Date(),
}: {
  card: ProgrammeCardData;
  /** rail: 272 × 384 (236 × 300 on phones). grid: fluid width, cover stays 16:9. */
  mode?: "rail" | "grid";
  tracking?: boolean;
  now?: Date;
}) {
  const inst = card.institution;
  const days = card.nextDeadline ? daysUntil(card.nextDeadline, now) : null;
  const urgent = isUrgent(days);
  const duration = formatDuration(card.durationMonths);
  const href = `/programs/${card.id}`;
  const place = [inst.city, countryName(inst.countryCode)].filter(Boolean).join(", ");

  return (
    <article
      className={cn(
        "group/poster relative flex flex-col rounded-poster bg-white shadow-hairline transition-shadow",
        "can-hover:hover:shadow-preview can-hover:focus-within:shadow-preview",
        mode === "rail" ? "w-[236px] md:w-[272px]" : "w-full",
      )}
    >
      {/* Cover, 16:9 */}
      <div className="relative aspect-video">
        <div className="absolute inset-0 overflow-hidden rounded-t-poster">
          <CoverImage
            institutionId={inst.id}
            countryCode={inst.countryCode}
            city={inst.city}
            photo={inst.cover}
            sizes={mode === "rail" ? POSTER_SIZES : GRID_SIZES}
          />
        </div>
        {card.match && (
          <ScoreDial score={card.match.score} strength={card.match.strength} size={46} className="pointer-events-none absolute top-2.5 left-2.5 z-10" />
        )}
        <div className="absolute top-1.5 right-1.5 z-10">
          <SaveButton targetType="program" targetId={card.id} title={card.title} initialSaved={card.saved} variant="onImage" />
        </div>
        <InstitutionLogo
          name={inst.name}
          logoUrl={inst.logoUrl}
          acronym={inst.acronym}
          seed={inst.id}
          size={44}
          surface="image"
          className="pointer-events-none absolute -bottom-[22px] left-4 z-10 md:hidden"
        />
        <InstitutionLogo
          name={inst.name}
          logoUrl={inst.logoUrl}
          acronym={inst.acronym}
          seed={inst.id}
          size={52}
          surface="image"
          className="pointer-events-none absolute -bottom-[26px] left-4 z-10 hidden md:inline-flex"
        />
      </div>

      {/* Body: fixed height so the preview swaps in place */}
      <div className="flex h-[167px] flex-col gap-1.5 px-4 pt-[30px] pb-4 md:h-[231px] md:pt-[34px]">
        <h3 className="type-poster-title clamp-2 text-ink">
          <Link
            href={href}
            className="rounded-sm outline-offset-4 before:absolute before:inset-0 before:z-0 before:rounded-poster before:content-[''] hover:text-kick-blue"
          >
            {card.title}
          </Link>
        </h3>

        <div className="relative min-h-0 flex-1">
          {/* Normal state */}
          <div
            className={cn(
              "ks-fade pointer-events-none absolute inset-0 flex flex-col gap-1.5",
              "can-hover:group-hover/poster:opacity-0 can-hover:group-hover/poster:delay-[250ms]",
              "can-hover:group-focus-within/poster:opacity-0",
            )}
          >
            <p className="flex min-w-0 items-center gap-2 type-meta text-ink-3">
              <CountryFlag code={inst.countryCode} />
              <span className="truncate">
                {inst.name}
                <span className="sr-only">{place ? `, ${place}` : ""}</span>
              </span>
            </p>
            <ul className="mt-auto flex flex-col gap-1.5 type-meta" role="list">
              {card.bestFunding && (
                <li className={cn("flex items-center gap-2", card.bestFunding.positive ? "font-bold text-green-text" : "text-ink-2")}>
                  <Coins aria-hidden="true" className={cn("size-4 shrink-0", card.bestFunding.positive ? "text-kick-green" : "text-ink-3")} />
                  <span className="truncate">{card.bestFunding.label}</span>
                </li>
              )}
              {duration && (
                <li className="hidden items-center gap-2 text-ink-2 md:flex">
                  <GraduationCap aria-hidden="true" className="size-4 shrink-0 text-ink-3" />
                  <span className="truncate">{duration}</span>
                </li>
              )}
              {days !== null && days >= 0 && (
                <li className={cn("flex items-center gap-2", urgent ? "font-bold text-kick-red" : "text-ink-2")}>
                  <Clock aria-hidden="true" className={cn("size-4 shrink-0", urgent ? "text-kick-red" : "text-ink-3")} />
                  <span className="truncate">{closesIn(days)}</span>
                </li>
              )}
            </ul>
          </div>

          {/* Preview state (precise pointers only) */}
          <div
            className={cn(
              "ks-fade invisible absolute inset-0 z-10 flex flex-col gap-2 opacity-0",
              "can-hover:group-hover/poster:visible can-hover:group-hover/poster:opacity-100 can-hover:group-hover/poster:delay-[250ms]",
              "can-hover:group-focus-within/poster:visible can-hover:group-focus-within/poster:opacity-100",
            )}
          >
            {card.reasons.length > 0 ? (
              <ul className="flex flex-col gap-1.5 type-meta" role="list">
                {card.reasons.map((r) => (
                  <li key={r.text} className="flex items-start gap-2 text-ink-2">
                    {r.met ? (
                      <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-kick-green" />
                    ) : (
                      <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-kick-red" />
                    )}
                    <span className="clamp-2">
                      <span className="sr-only">{r.met ? "Meets: " : "Gap: "}</span>
                      {r.text}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-2 type-meta text-ink-3">
                <CountryFlag code={inst.countryCode} />
                <span className="truncate">{inst.name}</span>
              </p>
            )}
            <div className="mt-auto flex items-center gap-2">
              <Link
                href={href}
                tabIndex={-1}
                className="inline-flex h-11 flex-1 items-center justify-center rounded-full bg-kick-blue px-4 text-[15px] font-bold text-white hover:bg-kick-blue-hover"
              >
                Open programme
              </Link>
              <CompareButton
                item={{
                  id: card.id,
                  title: card.title,
                  institution: { id: inst.id, name: inst.name, logoUrl: inst.logoUrl, acronym: inst.acronym },
                }}
              />
              <TrackButton targetType="PROGRAM" targetId={card.id} title={card.title} initialTracking={tracking} variant="icon" />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
