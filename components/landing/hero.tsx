"use client";

import Link from "next/link";
import { useState } from "react";
import dynamic from "next/dynamic";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { Button } from "@/components/ui/button";
import { HeroMatchingVisual } from "./hero-matching-visual";

const HeroAntigravityBackground = dynamic(
  () => import("./hero-antigravity").then((m) => m.HeroAntigravityBackground),
  { ssr: false },
);

const item: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] },
  }),
};

export function Hero() {
  const reduceMotion = useReducedMotion();
  const [heroEl, setHeroEl] = useState<HTMLElement | null>(null);
  const animProps = (i: number) =>
    reduceMotion
      ? {}
      : { custom: i, initial: "hidden", animate: "visible", variants: item };

  return (
    <section ref={setHeroEl} className="relative overflow-hidden">
      <HeroAntigravityBackground eventSource={heroEl} />

      <div className="relative z-10 mx-auto grid max-w-6xl gap-12 px-6 pt-16 pb-20 md:grid-cols-2 md:items-center md:px-12 md:pt-24 md:pb-28">
        <div>
          <motion.h1
            {...animProps(0)}
            className="text-4xl leading-tight font-semibold tracking-tight text-balance md:text-6xl"
          >
            Find <span className="text-kick-blue">universities and</span>{" "}
            <span className="text-kick-green">scholarships</span> you
            actually <span className="text-kick-blue">qualify for</span>.
          </motion.h1>

          <motion.p
            {...animProps(1)}
            className="mt-6 max-w-xl text-lg text-balance text-muted-foreground"
          >
            KickScholar matches your academic profile against real, sourced
            eligibility data — so you can discover opportunities that fit
            you, understand why you qualify, and know what to do next.
          </motion.p>

          <motion.div
            {...animProps(2)}
            className="mt-8 flex flex-col gap-3 sm:flex-row"
          >
            <Button size="lg" render={<Link href="/signup">Find my matches</Link>} />
            <Button
              size="lg"
              variant="outline"
              render={<Link href="#how-it-works">See how it works</Link>}
            />
          </motion.div>

          <motion.p
            {...animProps(3)}
            className="mt-4 text-sm text-muted-foreground"
          >
            Built around your academic profile, not generic search results.
          </motion.p>
        </div>

        <HeroMatchingVisual />
      </div>
    </section>
  );
}
