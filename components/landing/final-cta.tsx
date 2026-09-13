import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Reveal } from "./reveal";

export function FinalCta() {
  return (
    <section className="relative overflow-hidden border-t border-border">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/2 h-72 w-[36rem] -translate-x-1/2 animate-[kick-aurora-drift_14s_ease-in-out_infinite] rounded-full bg-kick-blue/10 blur-3xl" />
        <div className="absolute right-1/4 bottom-0 h-64 w-64 animate-[kick-aurora-drift_10s_ease-in-out_infinite_2s] rounded-full bg-kick-green/10 blur-3xl" />
      </div>

      <div className="mx-auto max-w-3xl px-6 py-24 text-center md:px-12">
        <Reveal>
          <h2 className="text-3xl font-semibold tracking-tight text-balance md:text-4xl">
            Your next university might already be within reach.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Build your profile and discover opportunities matched to you.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" render={<Link href="/signup">Find my matches</Link>} />
            <Button
              size="lg"
              variant="outline"
              render={<Link href="/scholarships">Explore scholarships</Link>}
            />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
