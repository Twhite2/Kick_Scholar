import { CheckCircle2, MapPin, CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Mono } from "@/components/ui/mono";
import { Reveal } from "./reveal";

export function ProductPreview() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24 md:px-12">
      <Reveal>
        <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-balance md:text-4xl">
          See it before you build your profile.
        </h2>
        <p className="mt-3 max-w-xl text-muted-foreground">
          A preview of how KickScholar presents your matches — clear,
          ranked, and explained.
        </p>
      </Reveal>

      <Reveal delay={0.1}>
        <div className="mt-10 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <div>
              <p className="text-sm font-semibold">Your Matches</p>
              <p className="text-xs text-muted-foreground">
                Mock preview — illustrative only
              </p>
            </div>
            <Badge variant="secondary">98 opportunities found</Badge>
          </div>

          <div className="grid gap-4 p-6 md:grid-cols-[1.2fr_1fr]">
            <div className="rounded-xl border border-border p-5 transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">University of Helsinki</p>
                  <p className="text-sm text-muted-foreground">
                    MSc Computer Science
                  </p>
                </div>
                <Mono className="text-lg font-semibold text-kick-blue">
                  92%
                </Mono>
              </div>
              <div className="mt-3 space-y-1.5 text-sm">
                <span className="flex items-center gap-1.5 text-success">
                  <CheckCircle2 className="size-3.5" /> Academic requirement
                </span>
                <span className="flex items-center gap-1.5 text-success">
                  <CheckCircle2 className="size-3.5" /> Degree requirement
                </span>
                <span className="flex items-center gap-1.5 text-success">
                  <CheckCircle2 className="size-3.5" /> International
                  applicants
                </span>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MapPin className="size-3.5" /> Finland Scholarship
                </span>
                <span className="flex items-center gap-1">
                  <CalendarClock className="size-3.5" /> Deadline 12 Oct 2026
                </span>
              </div>
            </div>

            <div className="grid gap-3">
              <div className="rounded-xl border border-border p-4">
                <p className="text-xs font-medium text-muted-foreground">
                  University matches
                </p>
                <p className="mt-1 text-2xl font-semibold">34</p>
              </div>
              <div className="rounded-xl border border-border p-4">
                <p className="text-xs font-medium text-muted-foreground">
                  Scholarship matches
                </p>
                <p className="mt-1 text-2xl font-semibold">61</p>
              </div>
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                <p className="text-xs font-medium text-destructive">
                  Needs attention
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Missing IELTS score for 3 matches
                </p>
              </div>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
