"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Mono } from "@/components/ui/mono";
import { cn } from "@/lib/utils";

function useCountUp(target: number, durationMs = 700) {
  const [value, setValue] = useState(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) {
      setValue(target);
      return;
    }
    let start: number | null = null;
    let frame: number;
    function step(ts: number) {
      if (start === null) start = ts;
      const progress = Math.min(1, (ts - start) / durationMs);
      setValue(Math.round(progress * target));
      if (progress < 1) frame = requestAnimationFrame(step);
    }
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs, reduceMotion]);

  return value;
}

export function StatCard({
  label,
  value,
  icon,
  accent = "default",
}: {
  label: string;
  value: number;
  icon: ReactNode;
  accent?: "default" | "success";
}) {
  const animated = useCountUp(value);

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="flex items-center gap-4 p-5">
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-lg [&_svg]:size-5",
            accent === "success" ? "bg-success/10 text-success" : "bg-primary/10 text-primary",
          )}
        >
          {icon}
        </div>
        <div>
          <Mono className="block text-2xl font-semibold tabular-nums">{animated}</Mono>
          <span className="text-sm text-muted-foreground">{label}</span>
        </div>
      </CardContent>
    </Card>
  );
}
