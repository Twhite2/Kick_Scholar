"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { login } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const item: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] },
  }),
};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, undefined);
  const reduceMotion = useReducedMotion();
  // Where to return after signing in (the action only accepts same-site paths).
  const next = useSearchParams().get("next") ?? "";
  const animProps = (i: number) =>
    reduceMotion
      ? {}
      : { custom: i, initial: "hidden", animate: "visible", variants: item };

  return (
    <div className="w-full max-w-sm">
      <motion.h1 {...animProps(0)} className="type-page-h1 text-ink">
        Welcome back
      </motion.h1>
      <motion.p {...animProps(1)} className="mt-2 text-base text-ink-3">
        Enter your credentials to access your account.
      </motion.p>

      <motion.form {...animProps(2)} action={formAction} className="mt-8 space-y-5">
        <input type="hidden" name="next" value={next} />
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="m@example.com"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        {state?.error && (
          <p role="alert" className="text-[15px] font-bold text-red-text">
            {state.error}
          </p>
        )}
        <Button type="submit" className="w-full" size="xl" disabled={pending}>
          {pending ? "Logging in…" : "Log in"}
        </Button>
      </motion.form>

      <motion.p
        {...animProps(3)}
        className="mt-8 text-center text-[15px] text-ink-3"
      >
        Don&apos;t have an account?{" "}
        <Link href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"} className="font-bold text-kick-blue hover:underline">
          Sign up
        </Link>
      </motion.p>
    </div>
  );
}
