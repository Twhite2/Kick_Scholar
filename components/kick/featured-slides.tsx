import Link from "next/link";
import { CircleAlert, CircleCheck, Clock, Coins } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FeaturedProgramme } from "@/lib/types/cards";
import { countryName } from "@/lib/ui/country";
import { STRENGTH_LABEL } from "@/lib/ui/strength";
import { CoverImage } from "./cover-image";
import { CountryFlag } from "./country-flag";
import { InstitutionLogo } from "./institution-logo";
import { ScoreDial } from "./score-dial";
import { SaveButton } from "./save-button";

function Reasons({ reasons, size }: { reasons: FeaturedProgramme["longReasons"]; size: "lg" | "md" }) {
  if (reasons.length === 0) return null;
  return (
    <ul role="list" className={cn("flex flex-col gap-2.5 text-[#E3EBF4]", size === "lg" ? "text-base" : "text-[15px]")}>
      {reasons.map((r) => (
        <li key={r.text} className="flex items-start gap-2.5">
          {r.met ? (
            <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-on-night-success" />
          ) : (
            <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-on-night-danger" />
          )}
          <span>
            <span className="sr-only">{r.met ? "Meets: " : "Gap: "}</span>
            {r.text}
          </span>
        </li>
      ))}
    </ul>
  );
}

function place(f: FeaturedProgramme) {
  return [f.institution.city, countryName(f.institution.countryCode)].filter(Boolean).join(", ");
}

/** One desktop billboard slide (docs/ui-remodel.md §9.1.1). */
export function BillboardSlide({ f, first }: { f: FeaturedProgramme; first: boolean }) {
  const inst = f.institution;
  return (
    <div className="relative min-h-[700px]">
      <div className="absolute inset-y-0 right-0 w-[74%]">
        <CoverImage
          institutionId={inst.id}
          countryCode={inst.countryCode}
          city={inst.city}
          photo={inst.cover}
          sizes="(min-width: 768px) 74vw, 100vw"
          priority={first ? "desktop" : false}
        />
      </div>
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(90deg,#071D33_0%,#071D33_28%,rgba(7,29,51,.86)_44%,rgba(7,29,51,.22)_70%,rgba(7,29,51,0)_100%)]"
      />
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[180px] bg-[linear-gradient(0deg,#071D33,rgba(7,29,51,0))]" />
      {/* Keeps the floating top bar legible over light skies and photos. */}
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-[160px] bg-[linear-gradient(180deg,rgba(7,29,51,.82),rgba(7,29,51,0))]" />

      <div className="relative flex max-w-[calc(720px+2*var(--gutter))] flex-col gap-[22px] px-gutter pt-[116px] pb-[136px] text-white">
        <div className="flex items-center gap-3.5">
          <InstitutionLogo name={inst.name} logoUrl={inst.logoUrl} acronym={inst.acronym} seed={inst.id} size={56} surface="image" />
          <div className="min-w-0">
            <Link href={`/institutions/${inst.id}`} className="block truncate text-[17px] font-bold text-white hover:underline">
              {inst.name}
            </Link>
            {place(f) && (
              <p className="mt-0.5 flex items-center gap-2 text-sm text-on-night-muted">
                <CountryFlag code={inst.countryCode} tone="night" />
                {place(f)}
              </p>
            )}
          </div>
        </div>

        <h2 className="type-display-xl">{f.title}</h2>

        <Reasons reasons={f.longReasons} size="lg" />

        <div className="flex flex-wrap items-center gap-x-7 gap-y-3.5">
          {f.match && (
            <div className="flex items-center gap-3">
              <ScoreDial score={f.match.score} strength={f.match.strength} size={60} tone="night" />
              <div>
                <p className="text-base font-bold tabular-nums">
                  {STRENGTH_LABEL[f.match.strength]}, {f.match.score}%
                </p>
                {f.basis && <p className="text-[13px] text-on-night-muted">{f.basis}</p>}
              </div>
            </div>
          )}
          {f.fundingLine && (
            <p className="flex items-center gap-2 text-base">
              <Coins aria-hidden="true" className="size-5 shrink-0 text-on-night-success" />
              {f.fundingLine}
            </p>
          )}
          <p className="flex items-center gap-2 text-base">
            <Clock aria-hidden="true" className="size-5 shrink-0 text-on-night-muted" />
            {f.deadlineLine}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/programs/${f.id}#why`}
            className="inline-flex h-[52px] items-center rounded-full bg-white px-7 text-base font-bold text-ink hover:bg-[#E3EBF4]"
          >
            See why you match
          </Link>
          <SaveButton targetType="program" targetId={f.id} title={f.title} initialSaved={f.saved} variant="night" />
        </div>
      </div>
    </div>
  );
}

/** The phone version of a featured match (docs/ui-remodel.md §9.1.8). */
export function MobileFeaturedCard({ f }: { f: FeaturedProgramme }) {
  const inst = f.institution;
  return (
    <article className="relative flex h-full flex-col overflow-hidden rounded-feature bg-night-raised text-white">
      <div className="relative h-[204px]">
        <CoverImage
          institutionId={inst.id}
          countryCode={inst.countryCode}
          city={inst.city}
          photo={inst.cover}
          sizes="100vw"
        />
        {f.match && <ScoreDial score={f.match.score} strength={f.match.strength} size={46} className="absolute top-3 left-3" />}
        <div className="absolute top-2 right-2">
          <SaveButton targetType="program" targetId={f.id} title={f.title} initialSaved={f.saved} variant="onImage" />
        </div>
        <InstitutionLogo
          name={inst.name}
          logoUrl={inst.logoUrl}
          acronym={inst.acronym}
          seed={inst.id}
          size={52}
          surface="image"
          className="absolute -bottom-[26px] left-[18px]"
        />
      </div>
      <div className="flex flex-1 flex-col gap-3 px-[18px] pt-8 pb-[18px]">
        <div>
          <p className="truncate text-[13px] font-bold text-on-night-muted">{inst.name}</p>
          {place(f) && (
            <p className="mt-1 flex items-center gap-2 text-[13px] text-on-night-muted">
              <CountryFlag code={inst.countryCode} tone="night" />
              {place(f)}
            </p>
          )}
        </div>
        <h2 className="clamp-3 font-display text-[28px] leading-[1.05] font-bold tracking-[-0.02em]">{f.title}</h2>
        <Reasons reasons={f.longReasons} size="md" />
        <div className="flex flex-col gap-1.5 text-[15px]">
          {f.fundingLine && (
            <p className="flex items-center gap-2">
              <Coins aria-hidden="true" className="size-[18px] shrink-0 text-on-night-success" />
              {f.fundingLine}
            </p>
          )}
          <p className="flex items-center gap-2">
            <Clock aria-hidden="true" className="size-[18px] shrink-0 text-on-night-muted" />
            {f.deadlineLine}
          </p>
        </div>
        <Link
          href={`/programs/${f.id}#why`}
          className="mt-auto inline-flex h-[52px] w-full items-center justify-center rounded-full bg-white text-base font-bold text-ink"
        >
          See why you match
        </Link>
      </div>
    </article>
  );
}

/** Night hero with a message and two actions: no strong matches, or no profile yet. */
export function NightHero({
  title,
  body,
  primary,
  secondary,
  scene = "nordic",
}: {
  title: string;
  body: string;
  primary: { label: string; href: string };
  secondary: { label: string; href: string };
  scene?: "nordic" | "canal" | "gothic" | "modern" | "harbour";
}) {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden bg-night text-white">
      <div className="absolute inset-y-0 right-0 hidden w-[62%] md:block">
        <CoverImage institutionId="hero" countryCode="FI" scene={scene} sizes="62vw" />
      </div>
      <div
        aria-hidden="true"
        className="absolute inset-0 hidden bg-[linear-gradient(90deg,#071D33_0%,#071D33_38%,rgba(7,29,51,.7)_58%,rgba(7,29,51,0)_100%)] md:block"
      />
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-[160px] bg-[linear-gradient(180deg,rgba(7,29,51,.82),rgba(7,29,51,0))]" />
      <div className="relative flex max-w-[calc(720px+2*var(--gutter))] flex-col gap-5 px-gutter pt-28 pb-24 md:min-h-[560px] md:justify-center md:pt-32 md:pb-32">
        <h1 id="hero-title" className="type-display-l">
          {title}
        </h1>
        <p className="max-w-[56ch] text-lg text-on-night-muted">{body}</p>
        <div className="flex flex-wrap gap-3">
          <Link
            href={primary.href}
            className="inline-flex h-[52px] items-center rounded-full bg-white px-7 text-base font-bold text-ink hover:bg-[#E3EBF4]"
          >
            {primary.label}
          </Link>
          <Link
            href={secondary.href}
            className="inline-flex h-[52px] items-center rounded-full border border-white/45 px-7 text-base font-bold text-white hover:bg-white/10"
          >
            {secondary.label}
          </Link>
        </div>
      </div>
    </section>
  );
}
