import { Building2, Award, Globe2, ListChecks } from "lucide-react";
import { Reveal } from "./reveal";

const ITEMS = [
  { icon: Building2, label: "Universities" },
  { icon: Award, label: "Scholarships" },
  { icon: Globe2, label: "Countries" },
  { icon: ListChecks, label: "Eligibility criteria" },
];

export function TrustStrip() {
  return (
    <section className="border-y border-border bg-surface/60">
      <div className="mx-auto max-w-6xl px-6 py-10 md:px-12">
        <Reveal>
          <p className="text-center text-sm font-medium text-muted-foreground">
            One profile. Thousands of possibilities.
          </p>
        </Reveal>
        <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-4">
          {ITEMS.map((item, i) => (
            <Reveal key={item.label} delay={i * 0.06}>
              <div className="flex flex-col items-center gap-2 text-center">
                <item.icon className="size-5 text-primary" />
                <span className="text-sm font-medium">{item.label}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
