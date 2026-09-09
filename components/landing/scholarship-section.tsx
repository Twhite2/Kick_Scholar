import { Landmark, Building2, FlaskConical, Sparkles } from "lucide-react";
import { Reveal } from "./reveal";

const FUNDING_TYPES = [
  {
    icon: Landmark,
    label: "Government Scholarships",
    desc: "National and bilateral funding programs.",
  },
  {
    icon: Building2,
    label: "University Scholarships",
    desc: "Awards offered directly by the institution.",
  },
  {
    icon: FlaskConical,
    label: "Research Scholarships",
    desc: "Funding tied to research and assistantship roles.",
  },
  {
    icon: Sparkles,
    label: "Fully Funded Programs",
    desc: "Tuition, stipend, and living costs covered.",
  },
];

export function ScholarshipSection() {
  return (
    <section className="bg-surface/60 py-24">
      <div className="mx-auto max-w-6xl px-6 md:px-12">
        <Reveal>
          <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-balance md:text-4xl">
            Find funding alongside the degree you&apos;re applying for.
          </h2>
          <p className="mt-3 max-w-xl text-muted-foreground">
            KickScholar doesn&apos;t only match universities — it surfaces
            the funding opportunities that go with them.
          </p>
        </Reveal>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FUNDING_TYPES.map((funding, i) => (
            <Reveal key={funding.label} delay={i * 0.06}>
              <div className="h-full rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md">
                <div className="flex size-9 items-center justify-center rounded-lg bg-success/10 text-success">
                  <funding.icon className="size-5" />
                </div>
                <p className="mt-3 font-semibold">{funding.label}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {funding.desc}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
