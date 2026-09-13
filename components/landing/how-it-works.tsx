"use client";

import { motion, useReducedMotion } from "framer-motion";
import { UserCircle2, ListChecks, Compass, Rocket } from "lucide-react";
import { Mono } from "@/components/ui/mono";

const STEPS = [
  {
    n: "01",
    icon: UserCircle2,
    title: "Build your profile",
    body: "Tell KickScholar about your education, grades, field, nationality, study level, and preferences.",
  },
  {
    n: "02",
    icon: ListChecks,
    title: "Check your eligibility",
    body: "KickScholar compares your profile against sourced university and scholarship requirements.",
  },
  {
    n: "03",
    icon: Compass,
    title: "Explore your matches",
    body: "See opportunities as strong matches, possible matches, or ones you don't qualify for yet.",
  },
  {
    n: "04",
    icon: Rocket,
    title: "Take action",
    body: "See requirements, deadlines, funding, application links, and exactly what you're missing.",
  },
];

export function HowItWorks() {
  const reduceMotion = useReducedMotion();

  return (
    <section id="how-it-works" className="bg-surface/60 py-24">
      <div className="mx-auto max-w-6xl px-6 md:px-12">
        <motion.h2
          initial={reduceMotion ? undefined : { opacity: 0, y: 16 }}
          whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="max-w-2xl text-3xl font-semibold tracking-tight text-balance md:text-4xl"
        >
          From your profile to your next opportunity.
        </motion.h2>

        <div className="mt-12 grid gap-6 md:grid-cols-4">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.n}
              initial={reduceMotion ? undefined : { opacity: 0, y: 24 }}
              whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.45, delay: i * 0.08 }}
              className="rounded-2xl border border-border bg-card p-5 transition-shadow hover:shadow-md"
            >
              <Mono className="text-xs font-semibold text-muted-foreground">
                {step.n}
              </Mono>
              <div className="mt-3 flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <step.icon className="size-5" />
              </div>
              <h3 className="mt-3 font-semibold">{step.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {step.body}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
