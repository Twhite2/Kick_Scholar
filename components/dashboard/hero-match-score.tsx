"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Mono } from "@/components/ui/mono";

function useCountUp(target: number, durationMs = 900) {
  const [value, setValue] = useState(0);
  const reduceMotion = useReducedMotion();
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (reduceMotion) {
      setValue(target);
      return;
    }
    startRef.current = null;
    let frame: number;
    function step(ts: number) {
      if (startRef.current === null) startRef.current = ts;
      const progress = Math.min(1, (ts - startRef.current) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) frame = requestAnimationFrame(step);
    }
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs, reduceMotion]);

  return value;
}

function scoreColor(score: number) {
  if (score >= 80) return "var(--success)";
  if (score >= 60) return "var(--primary)";
  return "var(--muted-foreground)";
}

export function HeroMatchScore({
  score,
  programCount,
  scholarshipCount,
  topCountries,
}: {
  score: number;
  programCount: number;
  scholarshipCount: number;
  topCountries: string[];
}) {
  const animated = useCountUp(score);
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);
  const color = scoreColor(score);

  return (
    <div className="flex flex-col items-center gap-6 rounded-2xl border border-border bg-gradient-to-br from-surface to-surface-alt p-8 md:flex-row md:items-center md:justify-between md:p-10">
      <div className="relative flex size-44 shrink-0 items-center justify-center">
        <svg viewBox="0 0 160 160" className="size-44 -rotate-90">
          <circle cx="80" cy="80" r={radius} fill="none" stroke="var(--border)" strokeWidth="10" />
          <motion.circle
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 0.9, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <Mono className="text-4xl font-semibold tabular-nums">{animated}%</Mono>
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Match</span>
        </div>
      </div>

      <div className="text-center md:text-left">
        <h2 className="text-xl font-semibold tracking-tight md:text-2xl">Your Study Abroad Potential</h2>
        <p className="mt-2 max-w-md text-muted-foreground">
          You currently match{" "}
          <span className="font-semibold text-foreground">{programCount} programs</span> and{" "}
          <span className="font-semibold text-foreground">{scholarshipCount} scholarships</span>.
        </p>
        {topCountries.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Strongest opportunities
            </p>
            <div className="mt-1.5 flex flex-wrap justify-center gap-2 md:justify-start">
              {topCountries.map((c) => (
                <span
                  key={c}
                  className="rounded-full bg-background px-3 py-1 text-sm font-medium text-kick-blue ring-1 ring-border"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
