import Link from "next/link";
import { ChevronRight, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InstitutionFace, MatchInfo } from "@/lib/types/cards";
import { countryName } from "@/lib/ui/country";
import { STRENGTH_LABEL } from "@/lib/ui/strength";
import { CoverImage } from "../cover-image";
import { CountryFlag } from "../country-flag";
import { InstitutionLogo } from "../institution-logo";
import { ScoreDial } from "../score-dial";

export interface Crumb {
  label: string;
  href?: string;
}

/** Breadcrumb on night surfaces. */
export function NightBreadcrumb({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1 text-sm text-[#D5E0EC]">
        {crumbs.map((c, i) => (
          <li key={`${c.label}-${i}`} className="flex items-center gap-1">
            {i > 0 && <ChevronRight aria-hidden="true" className="size-3.5 text-on-night-muted" />}
            {c.href ? (
              <Link href={c.href} className="inline-flex min-h-11 items-center hover:text-white hover:underline md:min-h-0">
                {c.label}
              </Link>
            ) : (
              <span aria-current="page" className="truncate text-on-night-muted">
                {c.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Dial, strength and basis, linking to the breakdown (§9.3). */
export function BannerScoreCard({ match, basis }: { match: MatchInfo | null; basis: string | null }) {
  if (!match) {
    return (
      <Link
        href="/profile"
        className="inline-flex min-h-11 items-center rounded-panel border border-white/[.18] bg-[rgba(7,29,51,.72)] px-[22px] py-[18px] text-base font-bold text-on-night-link hover:underline"
      >
        Complete your profile to see your match
      </Link>
    );
  }
  return (
    <div className="flex items-center gap-4 rounded-panel border border-white/[.18] bg-[rgba(7,29,51,.72)] px-[22px] py-[18px] text-white backdrop-blur-sm">
      <ScoreDial score={match.score} strength={match.strength} size={88} tone="night" />
      <div>
        <p className="font-display text-[22px] leading-tight font-bold">{STRENGTH_LABEL[match.strength]}</p>
        {basis && <p className="mt-0.5 text-sm text-on-night-muted">{basis}</p>}
        <a href="#why" className="mt-1 inline-flex min-h-11 items-center text-[15px] font-bold text-on-night-link hover:underline md:min-h-0">
          See the breakdown
        </a>
      </div>
    </div>
  );
}

/**
 * Night banner for programme and university pages (§9.3, §9.5): cover on the
 * right fading into night, content bottom-aligned, photo credit when a photo
 * is shown.
 */
export function DetailBanner({
  face,
  crumbs,
  title,
  institutionLink = true,
  subtitle,
  pills,
  aside,
  dataSaver,
  showPhoto,
  photoHref,
}: {
  face: InstitutionFace;
  crumbs: Crumb[];
  title: string;
  /** Link the institution name to its page (false on the institution page itself). */
  institutionLink?: boolean;
  /** Replaces the institution line when institutionLink is false. */
  subtitle?: React.ReactNode;
  pills?: React.ReactNode;
  aside?: React.ReactNode;
  dataSaver: boolean;
  /** "Show photo" was pressed: ignore data saver for this page. */
  showPhoto: boolean;
  /** URL that sets showPhoto. */
  photoHref: string;
}) {
  const place = [face.city, countryName(face.countryCode)].filter(Boolean).join(", ");
  const photoVisible = Boolean(face.cover) && (!dataSaver || showPhoto);

  return (
    <section aria-labelledby="page-title" className="relative isolate overflow-hidden bg-night text-white">
      <div className="absolute inset-0 md:left-auto md:w-[70%]">
        <CoverImage
          institutionId={face.id}
          countryCode={face.countryCode}
          city={face.city}
          photo={face.cover}
          sizes="(min-width: 768px) 70vw, 100vw"
          priority
          forcePhoto={showPhoto}
        />
      </div>
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[rgba(7,29,51,.78)] md:bg-[linear-gradient(90deg,#071D33_0%,#071D33_30%,rgba(7,29,51,.86)_48%,rgba(7,29,51,.25)_78%,rgba(7,29,51,.1)_100%)]"
      />
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-[150px] bg-[linear-gradient(180deg,rgba(7,29,51,.8),rgba(7,29,51,0))]" />
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[160px] bg-[linear-gradient(0deg,#071D33,rgba(7,29,51,0))]" />

      <div className="relative flex min-h-[440px] flex-col justify-end gap-6 px-gutter pt-24 pb-11 md:pt-28">
        <NightBreadcrumb crumbs={crumbs} />
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 max-w-[860px] flex-col gap-5">
            <div className="flex items-center gap-4">
              <InstitutionLogo name={face.name} logoUrl={face.logoUrl} acronym={face.acronym} seed={face.id} size={72} surface="image" />
              <div className="min-w-0">
                {institutionLink ? (
                  <Link href={`/institutions/${face.id}`} className="text-[17px] font-bold text-white hover:underline">
                    {face.name}
                  </Link>
                ) : (
                  subtitle
                )}
                {institutionLink && place && (
                  <p className="mt-1 flex items-center gap-2 text-sm text-on-night-muted">
                    <CountryFlag code={face.countryCode} tone="night" />
                    {place}
                  </p>
                )}
              </div>
            </div>
            <h1 id="page-title" className="type-display-l">
              {title}
            </h1>
            {pills && <div className="flex flex-wrap gap-2">{pills}</div>}
          </div>
          {aside && <div className="shrink-0">{aside}</div>}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3 text-[13px] text-on-night-muted">
          {face.cover && dataSaver && !showPhoto && (
            <Link href={photoHref} scroll={false} className="inline-flex min-h-11 items-center gap-1.5 font-bold text-on-night-link hover:underline">
              <ImageIcon aria-hidden="true" className="size-4" /> Show photo
            </Link>
          )}
          {photoVisible && face.cover?.credit && (
            <p className={cn("max-w-[60ch] text-right")}>
              Photo:{" "}
              {face.cover.sourceUrl ? (
                <a href={face.cover.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-white">
                  {face.cover.credit}
                </a>
              ) : (
                face.cover.credit
              )}
              {face.cover.license && <>, {face.cover.license}</>}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
