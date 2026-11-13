"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import dynamic from "next/dynamic";

const HeroAntigravityBackground = dynamic(
  () => import("./hero-antigravity").then((m) => m.HeroAntigravityBackground),
  { ssr: false },
);

/**
 * Landing hero in the billboard style (docs/ui-remodel.md §9.11): night
 * background, a scene on the right, one-colour headline, and a mock match
 * card that is labelled as an example.
 */
export function Hero({ visual }: { visual: React.ReactNode }) {
  const [heroEl, setHeroEl] = useState<HTMLElement | null>(null);

  return (
    <section ref={setHeroEl} aria-labelledby="landing-title" className="relative overflow-hidden bg-night text-white">
      <div aria-hidden="true" className="absolute inset-y-0 right-0 hidden w-[60%] md:block">
        <Image src="/scenes/nordic.svg" alt="" fill priority unoptimized className="object-cover object-bottom" />
      </div>
      <div
        aria-hidden="true"
        className="absolute inset-0 hidden bg-[linear-gradient(90deg,#071D33_0%,#071D33_40%,rgba(7,29,51,.8)_58%,rgba(7,29,51,.35)_100%)] md:block"
      />
      <HeroAntigravityBackground eventSource={heroEl} />

      <div className="relative grid gap-12 px-gutter pt-28 pb-20 md:grid-cols-[1.15fr_1fr] md:items-center md:pt-36 md:pb-28">
        <div className="max-w-[720px]">
          <h1 id="landing-title" className="type-display-xl">
            Find universities and scholarships you actually qualify for.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-on-night-muted">
            KickScholar matches your academic profile against real, sourced eligibility data, so you can discover
            opportunities that fit you, understand why you qualify, and know what to do next.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex h-[52px] items-center justify-center rounded-full bg-white px-7 text-base font-bold text-ink hover:bg-[#E3EBF4]"
            >
              Find my matches
            </Link>
            <Link
              href="#how-it-works"
              className="inline-flex h-[52px] items-center justify-center rounded-full border border-white/45 px-7 text-base font-bold text-white hover:bg-white/10"
            >
              See how it works
            </Link>
          </div>
          <p className="mt-4 text-sm text-on-night-muted">Built around your academic profile, not generic search results.</p>
        </div>
        {visual}
      </div>
    </section>
  );
}
