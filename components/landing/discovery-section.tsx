import { Reveal } from "./reveal";

const DESIRES = [
  "I want to study AI",
  "I want a fully funded Master's",
  "I want to study in Europe",
  "I want a PhD",
  "I want scholarships with no application fee",
];

export function DiscoverySection() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24 md:px-12">
      <Reveal>
        <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-balance md:text-4xl">
          For students who already know what they want.
        </h2>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Whatever you&apos;re looking for, your profile is the starting
          point.
        </p>
      </Reveal>

      <Reveal delay={0.1}>
        <div className="mt-8 flex flex-wrap gap-3">
          {DESIRES.map((desire) => (
            <span
              key={desire}
              className="cursor-default rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
            >
              {desire}
            </span>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
