import {
  Search,
  FileText,
  Scale,
  ListChecks,
  CalendarClock,
  HelpCircle,
} from "lucide-react";
import { Reveal } from "./reveal";

const FRAGMENTS = [
  { icon: Search, label: "Search dozens of university websites" },
  { icon: FileText, label: "Interpret complicated eligibility requirements" },
  { icon: Scale, label: "Compare academic requirements" },
  { icon: ListChecks, label: "Manually determine scholarship eligibility" },
  { icon: CalendarClock, label: "Track deadlines" },
  { icon: HelpCircle, label: "Figure out what to apply to" },
];

export function ProblemSection() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24 md:px-12">
      <Reveal>
        <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-balance md:text-4xl">
          Finding opportunities shouldn&apos;t feel like detective work.
        </h2>
      </Reveal>

      <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FRAGMENTS.map((fragment, i) => (
          <Reveal key={fragment.label} delay={i * 0.05}>
            <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              <fragment.icon className="size-4 shrink-0" />
              {fragment.label}
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal delay={0.3}>
        <p className="mt-10 text-xl font-semibold text-kick-blue">
          KickScholar brings it together.
        </p>
      </Reveal>
    </section>
  );
}
