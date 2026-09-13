import { ShieldCheck } from "lucide-react";
import { Mono } from "@/components/ui/mono";
import { Reveal } from "./reveal";

const ROWS = [
  {
    source: "University of Helsinki — Admissions Office",
    requirement: "Minimum Bachelor's GPA for MSc admission",
    provenance: "Sourced from official page",
  },
  {
    source: "Finland National Scholarship Programme",
    requirement: "Eligible nationalities and degree level",
    provenance: "Sourced from provider page",
  },
];

export function DataTrustSection() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24 md:px-12">
      <Reveal>
        <div className="flex items-center gap-2 text-kick-blue">
          <ShieldCheck className="size-5" />
          <span className="text-sm font-medium">Sourced, not guessed</span>
        </div>
        <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-balance md:text-4xl">
          Eligibility data you can understand.
        </h2>
        <p className="mt-4 max-w-xl text-muted-foreground">
          We don&apos;t just tell you that you&apos;re eligible — we show you
          where each requirement comes from and how it compares to your
          profile.
        </p>
      </Reveal>

      <Reveal delay={0.15}>
        <div className="mt-10 overflow-hidden rounded-2xl border border-border">
          <div className="hidden grid-cols-3 gap-4 border-b border-border bg-muted/50 px-5 py-3 text-xs font-medium text-muted-foreground md:grid">
            <span>Source</span>
            <span>Requirement</span>
            <span>Provenance</span>
          </div>
          {ROWS.map((row) => (
            <div
              key={row.source}
              className="grid gap-1.5 border-b border-border px-5 py-4 last:border-b-0 md:grid-cols-3 md:items-center md:gap-4"
            >
              <p className="text-sm font-medium">{row.source}</p>
              <p className="text-sm text-muted-foreground">
                {row.requirement}
              </p>
              <Mono className="text-xs text-muted-foreground">
                {row.provenance}
              </Mono>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
