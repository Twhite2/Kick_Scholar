"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Clock, Plus, X } from "lucide-react";
import { addApplicationDocument, markRejected, moveApplication, toggleApplicationDocument } from "@/lib/actions/applications";
import { cn } from "@/lib/utils";
import type { InstitutionFace } from "@/lib/types/cards";
import { closesIn, isUrgent } from "@/lib/ui/format";
import { InstitutionLogo } from "../institution-logo";

export interface BoardCard {
  id: string;
  title: string;
  href: string;
  organisation: string;
  institution: InstitutionFace | null;
  status: string;
  /** Days until the next published deadline, if any. */
  daysLeft: number | null;
  documents: Array<{ id: string; name: string; completed: boolean }>;
}

const MOVABLE = ["SAVED", "PLANNING", "IN_PROGRESS", "SUBMITTED", "ACCEPTED"];

/** One application on the board (§9.7). Moving stays button-based. */
export function ApplicationCard({ card }: { card: BoardCard }) {
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState<Record<string, boolean>>(() => Object.fromEntries(card.documents.map((d) => [d.id, d.completed])));
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const terminal = card.status === "ACCEPTED" || card.status === "REJECTED" || card.status === "WITHDRAWN";
  const index = MOVABLE.indexOf(card.status);
  const canBack = terminal || index > 0;
  const canForward = !terminal && index >= 0 && index < MOVABLE.length - 1;

  const run = (fn: () => Promise<{ error?: string } | { success: boolean }>) =>
    startTransition(async () => {
      setError(null);
      const result = await fn();
      if ("error" in result && result.error) setError(result.error);
    });

  function toggle(id: string, value: boolean) {
    setDone((d) => ({ ...d, [id]: value }));
    startTransition(async () => {
      const result = await toggleApplicationDocument(id, value);
      if ("error" in result) setDone((d) => ({ ...d, [id]: !value }));
    });
  }

  const inst = card.institution;
  const button =
    "inline-flex h-11 items-center gap-1.5 rounded-full border border-line-strong bg-white px-3.5 text-sm font-bold text-ink transition-colors hover:border-kick-blue hover:text-kick-blue disabled:opacity-40";

  return (
    <article id={`app-${card.id}`} className="scroll-mt-28 rounded-tile bg-white p-4 shadow-hairline target:shadow-preview">
      <div className="flex items-start gap-3">
        {inst && <InstitutionLogo name={inst.name} logoUrl={inst.logoUrl} acronym={inst.acronym} seed={inst.id} size={40} />}
        <div className="min-w-0">
          <h3 className="type-card-title clamp-2">
            <Link href={card.href} className="text-ink hover:text-kick-blue">
              {card.title}
            </Link>
          </h3>
          <p className="truncate text-sm text-ink-3">{card.organisation}</p>
        </div>
      </div>

      {card.daysLeft !== null && card.daysLeft >= 0 && (
        <p
          className={cn(
            "mt-3 inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 type-caption",
            isUrgent(card.daysLeft) ? "bg-red-tint text-red-text" : "bg-blue-tint text-kick-blue",
          )}
        >
          <Clock aria-hidden="true" className="size-3.5" />
          {closesIn(card.daysLeft)}
        </p>
      )}

      {card.documents.length > 0 && (
        <ul role="list" className="mt-3 space-y-1">
          {card.documents.map((d) => {
            const id = `doc-${d.id}`;
            return (
              <li key={d.id} className="flex min-h-11 items-center gap-2.5">
                <input
                  id={id}
                  type="checkbox"
                  checked={Boolean(done[d.id])}
                  onChange={(e) => toggle(d.id, e.target.checked)}
                  className="size-[20px] shrink-0 cursor-pointer accent-kick-blue"
                />
                <label htmlFor={id} className={cn("cursor-pointer text-sm leading-snug", done[d.id] ? "text-ink-3" : "text-ink")}>
                  {d.name}
                  {done[d.id] && <span className="sr-only"> (done)</span>}
                </label>
              </li>
            );
          })}
        </ul>
      )}

      <form
        className="mt-3 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const name = draft.trim();
          if (!name) return;
          setDraft("");
          run(() => addApplicationDocument(card.id, name));
        }}
      >
        <label htmlFor={`add-${card.id}`} className="sr-only">
          Add a document to {card.title}
        </label>
        <input
          id={`add-${card.id}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add document"
          className="h-11 min-w-0 flex-1 rounded-full border border-line-strong bg-white px-3.5 text-sm text-ink placeholder:text-ink-3 focus-visible:border-kick-blue"
        />
        <button type="submit" disabled={!draft.trim() || isPending} aria-label="Add document" className={cn(button, "w-11 justify-center px-0")}>
          <Plus aria-hidden="true" className="size-4" />
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
        {canBack && (
          <button type="button" disabled={isPending} onClick={() => run(() => moveApplication(card.id, "back"))} className={button}>
            <ArrowLeft aria-hidden="true" className="size-4" /> Move back
          </button>
        )}
        {canForward && (
          <button type="button" disabled={isPending} onClick={() => run(() => moveApplication(card.id, "forward"))} className={button}>
            Move forward <ArrowRight aria-hidden="true" className="size-4" />
          </button>
        )}
        {!terminal && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(() => markRejected(card.id))}
            className={cn(button, "text-red-text hover:border-kick-red hover:text-red-text")}
          >
            <X aria-hidden="true" className="size-4" /> Mark rejected
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm font-bold text-red-text">
          {error}
        </p>
      )}
    </article>
  );
}
