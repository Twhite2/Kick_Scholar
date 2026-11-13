import Link from "next/link";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DeadlineItem } from "@/lib/types/cards";
import { daysUntil, formatTicketDate, isUrgent, ticketCountdown } from "@/lib/ui/format";
import { InstitutionLogo } from "./institution-logo";

/**
 * A countdown ticket (docs/ui-remodel.md §9.1.6): the stub carries the days
 * left, red within 14 days; a dashed perforation with punched notches
 * separates it from the details.
 */
export function DeadlineTicket({ item, now = new Date() }: { item: DeadlineItem; now?: Date }) {
  const days = daysUntil(item.deadline, now);
  const urgent = isUrgent(days);
  const { value, label } = ticketCountdown(days);
  const inst = item.institution;

  return (
    <article className="relative flex h-[124px] w-[300px] rounded-tile bg-white shadow-hairline md:h-[132px] md:w-[340px]">
      <div
        className={cn(
          "flex w-[84px] shrink-0 flex-col items-center justify-center rounded-l-tile text-center md:w-[96px]",
          urgent ? "bg-red-tint text-red-text" : "bg-blue-tint text-kick-blue",
        )}
      >
        <span className={cn("type-countdown", value === "Today" && "text-[24px]! md:text-[26px]!")}>{value}</span>
        {label && <span className="mt-1 type-caption">{label}</span>}
      </div>

      {/* Perforation and punched notches */}
      <span
        aria-hidden="true"
        className="absolute top-3.5 bottom-3.5 left-[83px] border-l-2 border-dashed border-[#D5DCE4] md:left-[95px]"
      />
      <span aria-hidden="true" className="absolute -top-[9px] left-[75px] size-[18px] rounded-full bg-paper md:left-[87px]" />
      <span aria-hidden="true" className="absolute -bottom-[9px] left-[75px] size-[18px] rounded-full bg-paper md:left-[87px]" />

      <div className="flex min-w-0 flex-1 flex-col px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-2">
          {inst && (
            <InstitutionLogo name={inst.name} logoUrl={inst.logoUrl} acronym={inst.acronym} seed={inst.id} size={32} />
          )}
          <span className="truncate text-[13px] text-ink-3">{item.organisation}</span>
        </div>
        <h3 className="mt-1.5 type-card-title clamp-2 text-ink">
          <Link
            href={item.href}
            className="before:absolute before:inset-0 before:rounded-tile before:content-[''] hover:text-kick-blue"
          >
            {item.title}
          </Link>
        </h3>
        <p className="mt-auto flex items-center gap-1.5 text-[13px] text-ink-3">
          <Calendar aria-hidden="true" className="size-3.5" />
          Closes {formatTicketDate(item.deadline)}
        </p>
      </div>
    </article>
  );
}
