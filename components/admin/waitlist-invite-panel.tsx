"use client";

import { useState, useTransition } from "react";
import { adminInviteNext, type IssuedInvite } from "@/lib/actions/waitlist";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IssuedInviteList } from "./invite-links";

const select =
  "h-12 w-full rounded-xl border border-line-strong bg-white px-3 text-base text-ink hover:border-ink-3 focus-visible:border-varsity-blue";

/** "Invite the next N students aiming for a master's in Germany", oldest first. */
export function WaitlistInvitePanel({
  waiting,
  countries,
}: {
  waiting: number;
  countries: Array<{ code: string; name: string }>;
}) {
  const [degree, setDegree] = useState("");
  const [country, setCountry] = useState("");
  const [count, setCount] = useState(10);
  const [issued, setIssued] = useState<IssuedInvite[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const invite = () =>
    startTransition(async () => {
      setError(null);
      try {
        setIssued(await adminInviteNext({ count, degree: degree || null, country: country || null }));
      } catch {
        setError("The invites couldn't be made. Check the number (1 to 200) and try again.");
      }
    });

  return (
    <section aria-labelledby="invite-heading" className="rounded-panel bg-white p-5 shadow-hairline">
      <h2 id="invite-heading" className="font-display text-xl font-bold text-ink">
        Invite students
      </h2>
      <p className="mt-1 text-sm text-ink-3">Longest waiting first. Each person gets their own link, which works for 30 days.</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_1fr_120px_auto] sm:items-end">
        <div className="space-y-2">
          <Label htmlFor="invite-degree">Degree</Label>
          <select id="invite-degree" className={select} value={degree} onChange={(e) => setDegree(e.target.value)}>
            <option value="">Any</option>
            <option value="BACHELOR">Bachelor&rsquo;s</option>
            <option value="MASTER">Master&rsquo;s</option>
            <option value="PHD">PhD</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="invite-country">Wants to study in</Label>
          <select id="invite-country" className={select} value={country} onChange={(e) => setCountry(e.target.value)}>
            <option value="">Anywhere</option>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="invite-count">How many</Label>
          <Input
            id="invite-count"
            type="number"
            min={1}
            max={200}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
          />
        </div>
        <Button type="button" size="lg" disabled={pending || waiting === 0} onClick={invite}>
          {pending ? "Making links…" : `Invite ${count}`}
        </Button>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-[15px] font-bold text-red-text">
          {error}
        </p>
      )}
      {issued && issued.length === 0 && (
        <p role="status" className="mt-3 text-[15px] text-ink-2">
          Nobody waiting matches those choices.
        </p>
      )}
      {issued && <IssuedInviteList invites={issued} />}
    </section>
  );
}
