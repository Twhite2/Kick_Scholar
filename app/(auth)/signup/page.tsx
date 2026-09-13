"use client";

import Link from "next/link";
import { useActionState } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { signup } from "@/lib/actions/auth";
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

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signup, undefined);
  const reduceMotion = useReducedMotion();
  const animProps = (i: number) =>
    reduceMotion
      ? {}
      : { custom: i, initial: "hidden", animate: "visible", variants: item };

  return (
    <div className="w-full max-w-sm">
      <motion.h1 {...animProps(0)} className="text-3xl font-bold tracking-tight">
        Create your account
      </motion.h1>
      <motion.p {...animProps(1)} className="mt-2 text-muted-foreground">
        Find universities and scholarships you actually qualify for.
      </motion.p>

      <motion.form {...animProps(2)} action={formAction} className="mt-8 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            name="name"
            autoComplete="name"
            className="h-10"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="m@example.com"
            className="h-10"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            className="h-10"
            required
          />
        </div>
        {state?.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
        <Button type="submit" className="w-full" size="lg" disabled={pending}>
          {pending ? "Creating account…" : "Sign up"}
        </Button>
      </motion.form>

      <motion.p
        {...animProps(3)}
        className="mt-8 text-center text-sm text-muted-foreground"
      >
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Log in
        </Link>
      </motion.p>
    </div>
  );
}
