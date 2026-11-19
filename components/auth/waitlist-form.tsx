"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { joinWaitlist } from "@/lib/actions/waitlist";
import { MAX_WAITLIST_COUNTRIES } from "@/lib/waitlist/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const DEGREES = [
  { value: "BACHELOR", label: "Bachelor's" },
  { value: "MASTER", label: "Master's" },
  { value: "PHD", label: "PhD" },
];

const pill =
  "inline-flex min-h-11 cursor-pointer items-center rounded-full border border-line-strong bg-white px-4 text-[15px] font-bold text-ink transition-colors hover:border-ink-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-varsity-blue has-[:checked]:border-varsity-blue has-[:checked]:bg-varsity-blue has-[:checked]:text-white has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50";

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-sm font-bold text-red-text">
      {message}
    </p>
  );
}

/**
 * The waitlist, shown in place of sign-up while SIGNUP_MODE=invite. The
 * inputs are controlled so a validation error doesn't clear what was typed
 * (a form action resets uncontrolled fields when it finishes).
 */
export function WaitlistForm({
  countries,
  nationalities,
  source,
  notice,
}: {
  countries: Array<{ code: string; name: string }>;
  nationalities: string[];
  source: string | null;
  notice?: string;
}) {
  const [state, formAction, pending] = useActionState(joinWaitlist, undefined);
  const [email, setEmail] = useState("");
  const [degree, setDegree] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [nationality, setNationality] = useState("");

  if (state?.joined) {
    return (
      <div className="w-full max-w-sm" role="status">
        <CheckCircle2 aria-hidden className="size-10 text-green-text" />
        <h1 className="mt-4 type-page-h1 text-ink">You&rsquo;re on the list</h1>
        <p className="mt-3 text-base text-ink-2">
          We&rsquo;re letting students in a few at a time, starting with the destinations our data covers best.
          We&rsquo;ll send your invite to <span className="font-bold text-ink">{state.email}</span>.
        </p>
        <p className="mt-8 text-[15px] text-ink-3">
          <Link href="/" className="font-bold text-varsity-blue hover:underline">
            Back to VarsityFind
          </Link>
        </p>
      </div>
    );
  }

  const errors = state?.fieldErrors ?? {};
  const full = picked.length >= MAX_WAITLIST_COUNTRIES;
  const toggleCountry = (code: string) =>
    setPicked((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));

  return (
    <div className="w-full max-w-sm">
      <h1 className="type-page-h1 text-ink">Join the waitlist</h1>
      <p className="mt-2 text-base text-ink-3">
        VarsityFind is opening to students a few at a time. Tell us where you&rsquo;re headed and we&rsquo;ll invite
        you as soon as we can match you well.
      </p>
      {notice && (
        <p role="alert" className="mt-4 rounded-xl bg-blue-tint px-4 py-3 text-[15px] text-ink">
          {notice}
        </p>
      )}

      <form action={formAction} className="mt-8 space-y-6" noValidate>
        {source && <input type="hidden" name="source" value={source} />}
        {/* Left empty by people; see joinWaitlist. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
          <label>
            Website
            <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
          </label>
        </div>

        <div className="space-y-2">
          <Label htmlFor="waitlist-email">Email</Label>
          <Input
            id="waitlist-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="m@example.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!errors.email || undefined}
            aria-describedby={errors.email ? "waitlist-email-error" : undefined}
          />
          <FieldError id="waitlist-email-error" message={errors.email} />
        </div>

        <fieldset className="space-y-2.5" aria-describedby={errors.desiredDegreeLevel ? "waitlist-degree-error" : undefined}>
          <legend className="text-[15px] font-bold text-ink">Degree you&rsquo;re aiming for</legend>
          <div className="flex flex-wrap gap-2 pt-2.5">
            {DEGREES.map((d) => (
              <label key={d.value} className={pill}>
                <input
                  type="radio"
                  name="desiredDegreeLevel"
                  value={d.value}
                  checked={degree === d.value}
                  onChange={() => setDegree(d.value)}
                  className="sr-only"
                />
                {d.label}
              </label>
            ))}
          </div>
          <FieldError id="waitlist-degree-error" message={errors.desiredDegreeLevel} />
        </fieldset>

        <fieldset
          className="space-y-2.5"
          aria-describedby={errors.preferredCountries ? "waitlist-countries-hint waitlist-countries-error" : "waitlist-countries-hint"}
        >
          <legend className="text-[15px] font-bold text-ink">Where you&rsquo;d like to study</legend>
          <p id="waitlist-countries-hint" className="text-sm text-ink-3">
            Up to {MAX_WAITLIST_COUNTRIES}. Skip this if you&rsquo;re open to anywhere.
          </p>
          <div className="flex flex-wrap gap-2">
            {countries.map((c) => {
              const checked = picked.includes(c.code);
              return (
                <label key={c.code} className={cn(pill, "min-h-10 px-3.5 text-sm")}>
                  <input
                    type="checkbox"
                    name="preferredCountries"
                    value={c.code}
                    checked={checked}
                    disabled={!checked && full}
                    onChange={() => toggleCountry(c.code)}
                    className="sr-only"
                  />
                  {c.name}
                </label>
              );
            })}
          </div>
          <FieldError id="waitlist-countries-error" message={errors.preferredCountries} />
        </fieldset>

        <div className="space-y-2">
          <Label htmlFor="waitlist-nationality">
            Nationality <span className="font-normal text-ink-3">(optional)</span>
          </Label>
          <select
            id="waitlist-nationality"
            name="nationality"
            value={nationality}
            onChange={(e) => setNationality(e.target.value)}
            aria-describedby="waitlist-nationality-hint"
            className="h-12 w-full rounded-xl border border-line-strong bg-white px-3 text-base text-ink hover:border-ink-3 focus-visible:border-varsity-blue"
          >
            <option value="">Prefer not to say</option>
            {nationalities.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <p id="waitlist-nationality-hint" className="text-sm text-ink-3">
            Many scholarships depend on it, and deadlines often differ for EU and non-EU students.
          </p>
          <FieldError id="waitlist-nationality-error" message={errors.nationality} />
        </div>

        {state?.error && (
          <p role="alert" className="text-[15px] font-bold text-red-text">
            {state.error}
          </p>
        )}
        <Button type="submit" className="w-full" size="xl" disabled={pending}>
          {pending ? "Joining…" : "Join the waitlist"}
        </Button>
        <p className="text-sm text-ink-3">
          We use your answers only to decide when to invite you and to fill in your profile when you join. Ask us any
          time and we&rsquo;ll delete them.
        </p>
      </form>

      <p className="mt-8 text-center text-[15px] text-ink-3">
        Already have an account?{" "}
        <Link href="/login" className="font-bold text-varsity-blue hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
