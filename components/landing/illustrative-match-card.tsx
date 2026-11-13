import Image from "next/image";
import { CircleAlert, CircleCheck, Coins } from "lucide-react";
import { InstitutionLogo } from "@/components/kick/institution-logo";
import { CountryFlag } from "@/components/kick/country-flag";
import { ScoreDial } from "@/components/kick/score-dial";

/**
 * A static, clearly labelled mock-up of a match (docs/ui-remodel.md §9.11).
 * Not live data, so it says so on its face.
 */
export function IllustrativeMatchCard() {
  return (
    <figure className="relative mx-auto w-full max-w-[380px]">
      <div className="overflow-hidden rounded-feature bg-night-raised text-white shadow-raised">
        <div className="relative h-[180px]">
          <Image src="/scenes/nordic.svg" alt="" fill unoptimized className="object-cover object-bottom" />
          <ScoreDial score={92} strength="STRONG_MATCH" size={46} className="absolute top-3 left-3" animate={false} />
          <span className="absolute top-3 right-3 inline-flex h-7 items-center rounded-full bg-white px-2.5 type-caption text-ink">
            Illustrative example
          </span>
          <InstitutionLogo name="University of Helsinki" seed="example-helsinki" size={52} surface="image" className="absolute -bottom-[26px] left-[18px]" />
        </div>
        <div className="flex flex-col gap-3 px-[18px] pt-8 pb-5">
          <div>
            <p className="text-[13px] font-bold text-on-night-muted">University of Helsinki</p>
            <p className="mt-1 flex items-center gap-2 text-[13px] text-on-night-muted">
              <CountryFlag code="FI" tone="night" /> Helsinki, Finland
            </p>
          </div>
          <p className="font-display text-[26px] leading-[1.08] font-bold tracking-[-0.02em]">MSc in Computer Science</p>
          <ul className="flex flex-col gap-2 text-[15px] text-[#E3EBF4]">
            <li className="flex items-start gap-2.5">
              <CircleCheck aria-hidden="true" className="mt-0.5 size-[18px] shrink-0 text-on-night-success" />
              Your degree fits the course
            </li>
            <li className="flex items-start gap-2.5">
              <CircleCheck aria-hidden="true" className="mt-0.5 size-[18px] shrink-0 text-on-night-success" />
              Your CGPA clears the entry bar
            </li>
            <li className="flex items-start gap-2.5">
              <CircleAlert aria-hidden="true" className="mt-0.5 size-[18px] shrink-0 text-on-night-danger" />
              Needs an English test score
            </li>
          </ul>
          <p className="flex items-center gap-2 text-[15px]">
            <Coins aria-hidden="true" className="size-[18px] shrink-0 text-on-night-success" />
            A linked scholarship can cover tuition
          </p>
        </div>
      </div>
      <figcaption className="sr-only">An illustrative example of a match, not real data.</figcaption>
    </figure>
  );
}
