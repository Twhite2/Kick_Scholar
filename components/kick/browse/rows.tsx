import Link from "next/link";
import { Building2, Clock, Coins, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InstitutionFace, ProgrammeCardData, ScholarshipCardData } from "@/lib/types/cards";
import { countryName } from "@/lib/ui/country";
import { COVERAGE_LABEL, posterAmount } from "@/lib/ui/coverage";
import { closesIn, daysUntil, formatCount, formatDuration, isUrgent } from "@/lib/ui/format";
import { providerFace } from "@/lib/cards/faces";
import { InstitutionLogo } from "../institution-logo";
import { CountryFlag } from "../country-flag";
import { ScoreDial } from "../score-dial";
import { SaveButton } from "../save-button";
import { SourceBadge, Pill } from "../badges";
import { scholarshipDeadlineText } from "../funding-poster";

const rowClass = "relative flex items-center gap-4 rounded-tile bg-white px-4 py-3.5 shadow-hairline transition-shadow can-hover:hover:shadow-preview";
const stretched = "before:absolute before:inset-0 before:rounded-tile before:content-[''] hover:text-kick-blue";

/** Programme as a list row (§9.6 list view). */
export function ProgrammeRow({ card, now = new Date() }: { card: ProgrammeCardData; now?: Date }) {
  const inst = card.institution;
  const days = card.nextDeadline ? daysUntil(card.nextDeadline, now) : null;
  const duration = formatDuration(card.durationMonths);
  return (
    <article className={rowClass}>
      <InstitutionLogo name={inst.name} logoUrl={inst.logoUrl} acronym={inst.acronym} seed={inst.id} size={52} className="hidden sm:inline-flex" />
      <div className="min-w-0 flex-1">
        <h3 className="type-card-title clamp-2 text-ink">
          <Link href={`/programs/${card.id}`} className={stretched}>
            {card.title}
          </Link>
        </h3>
        <p className="mt-0.5 flex min-w-0 items-center gap-2 type-meta text-ink-3">
          <CountryFlag code={inst.countryCode} />
          <span className="truncate">{[inst.city, inst.name].filter(Boolean).join(" · ")}</span>
        </p>
        <ul role="list" className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {card.bestFunding && (
            <li className={cn("flex items-center gap-1.5", card.bestFunding.positive ? "font-bold text-green-text" : "text-ink-2")}>
              <Coins aria-hidden="true" className={cn("size-4", card.bestFunding.positive ? "text-kick-green" : "text-ink-3")} />
              {card.bestFunding.label}
            </li>
          )}
          {duration && (
            <li className="flex items-center gap-1.5 text-ink-2">
              <GraduationCap aria-hidden="true" className="size-4 text-ink-3" />
              {duration}
            </li>
          )}
          {days !== null && days >= 0 && (
            <li className={cn("flex items-center gap-1.5", isUrgent(days) ? "font-bold text-kick-red" : "text-ink-2")}>
              <Clock aria-hidden="true" className="size-4" />
              {closesIn(days)}
            </li>
          )}
        </ul>
      </div>
      {card.match && <ScoreDial score={card.match.score} strength={card.match.strength} size={46} className="shrink-0" />}
      <SaveButton targetType="program" targetId={card.id} title={card.title} initialSaved={card.saved} className="relative z-10" />
    </article>
  );
}

/** Scholarship as a list row. */
export function ScholarshipRow({ card, now = new Date() }: { card: ScholarshipCardData; now?: Date }) {
  const face = card.provider.institution ?? providerFace(card.provider.name);
  const amount = posterAmount({ coverage: card.coverage, amount: card.amount?.value ?? null, currency: card.amount?.currency ?? null });
  const urgent = card.nextDeadline ? isUrgent(daysUntil(card.nextDeadline, now)) : false;
  return (
    <article className={rowClass}>
      <InstitutionLogo name={face.name} logoUrl={face.logoUrl} acronym={face.acronym} seed={face.id} size={52} className="hidden sm:inline-flex" />
      <div className="min-w-0 flex-1">
        <h3 className="type-card-title clamp-2 text-ink">
          <Link href={`/scholarships/${card.id}`} className={stretched}>
            {card.title}
          </Link>
        </h3>
        <p className="mt-0.5 truncate type-meta text-ink-3">{card.provider.name}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
          <span className="flex items-center gap-1.5 font-bold text-green-text">
            <Coins aria-hidden="true" className="size-4 text-kick-green" />
            {COVERAGE_LABEL[card.coverage]}
            {amount.confirmed && <span className="text-ink-2">· {amount.text}</span>}
          </span>
          <span className={cn(urgent ? "font-bold text-kick-red" : "text-ink-3")}>{scholarshipDeadlineText(card, now)}</span>
          <SourceBadge verified={card.sourceVerified} className="relative z-10" />
        </div>
      </div>
      {card.match && <ScoreDial score={card.match.score} strength={card.match.strength} size={46} className="shrink-0" />}
      <SaveButton targetType="scholarship" targetId={card.id} title={card.title} initialSaved={card.saved} className="relative z-10" />
    </article>
  );
}

export interface UniversityCardData {
  face: InstitutionFace;
  type: string | null;
  programCount: number;
  fundingCount: number;
}

/** A university in the directory (§9.6): logo, name, flag, full country name, city, counts. */
export function UniversityCard({ u }: { u: UniversityCardData }) {
  const place = [u.face.city, countryName(u.face.countryCode)].filter(Boolean).join(", ");
  return (
    <article className="relative flex h-full flex-col gap-3 rounded-tile bg-white p-[18px] shadow-hairline transition-shadow can-hover:hover:shadow-preview">
      <div className="flex items-start gap-3.5">
        <InstitutionLogo name={u.face.name} logoUrl={u.face.logoUrl} acronym={u.face.acronym} seed={u.face.id} size={52} />
        <div className="min-w-0">
          <h3 className="type-card-title clamp-2 text-ink">
            <Link href={`/institutions/${u.face.id}`} className={stretched}>
              {u.face.name}
            </Link>
          </h3>
          <p className="mt-1 flex items-center gap-2 type-meta text-ink-3">
            <CountryFlag code={u.face.countryCode} />
            <span className="truncate">{place}</span>
          </p>
        </div>
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-2">
        {u.type && (
          <Pill>
            <Building2 aria-hidden="true" className="size-3.5" />
            {u.type === "PUBLIC" ? "Public" : "Private"}
          </Pill>
        )}
        <Pill tone="blue">{formatCount(u.programCount)} {u.programCount === 1 ? "programme" : "programmes"}</Pill>
        <Pill className={u.fundingCount > 0 ? "bg-green-tint text-green-text" : undefined}>
          {formatCount(u.fundingCount)} {u.fundingCount === 1 ? "scholarship" : "scholarships"}
        </Pill>
      </div>
    </article>
  );
}
