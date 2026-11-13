import Link from "next/link";
import { Reveal } from "./reveal";

export function FinalCta() {
  return (
    <section className="border-t border-line bg-night text-white">
      <div className="mx-auto max-w-3xl px-gutter py-24 text-center">
        <Reveal>
          <h2 className="type-display-l">Your next university might already be within reach.</h2>
          <p className="mt-4 text-lg text-on-night-muted">Build your profile and discover opportunities matched to you.</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex h-[52px] items-center rounded-full bg-white px-7 text-base font-bold text-ink hover:bg-[#E3EBF4]"
            >
              Find my matches
            </Link>
            <Link
              href="/signup?next=/scholarships"
              className="inline-flex h-[52px] items-center rounded-full border border-white/45 px-7 text-base font-bold text-white hover:bg-white/10"
            >
              Explore scholarships
            </Link>
          </div>
          <p className="mt-3 text-sm text-on-night-muted">Create a free account to browse.</p>
        </Reveal>
      </div>
    </section>
  );
}
