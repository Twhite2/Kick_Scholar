"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, GraduationCap, Award } from "lucide-react";
import { Mono } from "@/components/ui/mono";

/**
 * Illustrates the matching engine: a profile card connecting to a
 * university match and a scholarship match. Purely decorative/conceptual —
 * not live data.
 */
export function HeroMatchingVisual() {
  const reduceMotion = useReducedMotion();

  const float = (delay: number) =>
    reduceMotion
      ? {}
      : {
          animate: { y: [0, -8, 0] as number[] },
          transition: {
            duration: 5,
            repeat: Infinity,
            ease: "easeInOut" as const,
            delay,
          },
        };

  return (
    <div className="relative mx-auto h-[420px] w-full max-w-md" aria-hidden>
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 400 420"
        fill="none"
      >
        <path
          d="M130 110 C 200 150, 210 160, 270 200"
          stroke="var(--kick-blue)"
          strokeOpacity="0.3"
          strokeWidth="1.5"
          strokeDasharray="4 6"
        />
        <path
          d="M130 130 C 170 220, 180 250, 240 300"
          stroke="var(--kick-green)"
          strokeOpacity="0.3"
          strokeWidth="1.5"
          strokeDasharray="4 6"
        />
      </svg>

      <motion.div
        {...float(0)}
        className="absolute top-6 left-0 w-56 rounded-xl border border-border bg-card p-4 shadow-sm"
      >
        <p className="text-xs font-medium text-muted-foreground">
          Academic Profile
        </p>
        <p className="mt-1 text-sm font-semibold">BSc Computer Science</p>
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>CGPA</span>
          <Mono className="font-medium text-foreground">3.72 / 5.00</Mono>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground">
            Computer Science
          </span>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground">
            International
          </span>
        </div>
      </motion.div>

      <motion.div
        {...float(1.2)}
        className="absolute top-40 right-0 w-60 rounded-xl border border-border bg-card p-4 shadow-sm"
      >
        <div className="flex items-center gap-1.5 text-xs font-medium text-kick-blue">
          <GraduationCap className="size-3.5" />
          University Match
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-success">
          <CheckCircle2 className="size-3.5" />
          Eligibility confirmed
        </div>
        <p className="mt-2 text-sm font-semibold">University of Helsinki</p>
        <p className="text-xs text-muted-foreground">MSc Computer Science</p>
      </motion.div>

      <motion.div
        {...float(0.6)}
        className="absolute bottom-2 left-8 w-60 rounded-xl border border-border bg-card p-4 shadow-sm"
      >
        <div className="flex items-center gap-1.5 text-xs font-medium text-kick-green">
          <Award className="size-3.5" />
          Scholarship Match
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 text-xs text-success">
          <CheckCircle2 className="size-3.5" />
          Eligible
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <Mono className="text-lg font-semibold text-foreground">
            €13,000
          </Mono>
          <span className="text-xs text-muted-foreground">/ year</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Deadline · 12 Oct
        </p>
      </motion.div>
    </div>
  );
}
