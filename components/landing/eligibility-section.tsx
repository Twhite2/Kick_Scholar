import { CheckCircle2, AlertTriangle } from "lucide-react";
import { Mono } from "@/components/ui/mono";
import { Reveal } from "./reveal";

const REQUIREMENTS = [
  {
    label: "Bachelor's degree in Computer Science",
    detail: null,
    status: "met" as const,
  },
  {
    label: "Minimum GPA",
    detail: "Required 3.00 / 5.00 · Your GPA 3.72 / 5.00",
    status: "met" as const,
  },
  {
    label: "English proficiency",
    detail: "IELTS 6.5 required",
    status: "pending" as const,
  },
];

export function EligibilitySection() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24 md:px-12">
      <div className="grid gap-12 md:grid-cols-2 md:items-center">
        <Reveal>
          <h2 className="text-3xl font-semibold tracking-tight text-balance md:text-4xl">
            Don&apos;t just find opportunities.{" "}
            <span className="text-kick-blue">Understand why you qualify.</span>
          </h2>
          <p className="mt-4 max-w-md text-muted-foreground">
            Every match is broken down requirement by requirement, so you
            know exactly where you stand — and what&apos;s still missing.
          </p>
        </Reveal>

        <Reveal delay={0.15}>
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground">
              University requirement
            </p>
            <ul className="mt-4 space-y-4">
              {REQUIREMENTS.map((req) => (
                <li key={req.label} className="flex items-start gap-3">
                  {req.status === "met" ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                  ) : (
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
                  )}
                  <div>
                    <p className="text-sm font-medium">{req.label}</p>
                    {req.detail && (
                      <Mono className="text-xs text-muted-foreground">
                        {req.detail}
                      </Mono>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
