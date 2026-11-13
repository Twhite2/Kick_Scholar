"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toggleApplicationDocument } from "@/lib/actions/applications";
import type { NextStep } from "@/lib/ui/next-steps";
import { TrackButton } from "./track-button";

/**
 * "Your next steps" (docs/ui-remodel.md §9.3, §10.5). While tracking, the
 * ticks are the application's checklist. Before that, ticking invites the
 * student to track so the progress is kept.
 */
export function NextSteps({
  steps,
  checklist,
  target,
}: {
  steps: NextStep[];
  /** The application's documents, when the student is tracking this. */
  checklist: Array<{ id: string; name: string; completed: boolean }> | null;
  target: { type: "PROGRAM" | "SCHOLARSHIP"; id: string; title: string };
}) {
  const router = useRouter();
  const [prompt, setPrompt] = useState(false);
  const [done, setDone] = useState<Record<string, boolean>>(() =>
    Object.fromEntries((checklist ?? []).map((d) => [d.id, d.completed])),
  );
  const [, startTransition] = useTransition();

  const tracking = checklist !== null;
  const stepByName = new Map(steps.map((s) => [s.label.toLowerCase(), s]));
  const items = tracking
    ? checklist.map((d) => ({ key: d.id, label: d.name, step: stepByName.get(d.name.toLowerCase()), docId: d.id }))
    : steps.map((s) => ({ key: s.label, label: s.label, step: s, docId: null as string | null }));
  const completed = tracking ? Object.values(done).filter(Boolean).length : 0;
  const pct = items.length > 0 ? Math.round((completed / items.length) * 100) : 0;

  function toggle(docId: string | null, value: boolean) {
    if (!docId) {
      setPrompt(true);
      return;
    }
    setDone((d) => ({ ...d, [docId]: value }));
    startTransition(async () => {
      const result = await toggleApplicationDocument(docId, value);
      if ("error" in result) setDone((d) => ({ ...d, [docId]: !value }));
    });
  }

  return (
    <section aria-labelledby="steps-title" className="rounded-panel bg-white p-5 shadow-hairline md:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="steps-title" className="font-display text-xl font-bold text-ink">
          Your next steps
        </h2>
        <span className="text-sm text-ink-3 tabular-nums">
          {completed} of {items.length} done
        </span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-track" aria-hidden="true">
        <div className="h-full rounded-full bg-kick-blue" style={{ width: `${pct}%` }} />
      </div>
      <ul role="list" className="mt-4 space-y-3">
        {items.map((item) => {
          const checked = item.docId ? Boolean(done[item.docId]) : false;
          const id = `step-${item.key.replace(/[^a-z0-9]/gi, "-")}`;
          return (
            <li key={item.key} className="flex items-start gap-3">
              <input
                id={id}
                type="checkbox"
                checked={checked}
                onChange={(e) => toggle(item.docId, e.target.checked)}
                className="mt-0.5 size-[22px] shrink-0 cursor-pointer accent-kick-blue"
              />
              <div className="min-w-0">
                <label htmlFor={id} className={checked ? "cursor-pointer text-[15px] font-bold text-ink-3" : "cursor-pointer text-[15px] font-bold text-ink"}>
                  {item.label}
                </label>
                {item.step?.note && <p className="text-sm text-ink-3">{item.step.note}</p>}
                {item.step?.action && !checked && (
                  <Link href={item.step.action.href} className="inline-flex min-h-11 items-center text-sm font-bold text-kick-blue hover:underline">
                    {item.step.action.label}
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {!tracking && prompt && (
        <div role="status" className="mt-4 rounded-xl bg-blue-tint p-3.5">
          <p className="text-sm font-bold text-kick-blue">Track this application to save your progress</p>
          <div className="mt-2.5">
            <TrackButton
              targetType={target.type}
              targetId={target.id}
              title={target.title}
              initialTracking={false}
              variant="outline"
              onTracked={() => router.refresh()}
            />
          </div>
        </div>
      )}
    </section>
  );
}
