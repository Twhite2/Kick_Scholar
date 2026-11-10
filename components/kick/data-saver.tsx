"use client";

import { createContext, useCallback, useContext, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Data saver (docs/ui-remodel.md §12.1). The server renders from the `ks_ds`
 * cookie, so pictures are never downloaded and then hidden; this context only
 * flips the cookie and asks the server for fresh markup.
 */

const COOKIE = "ks_ds";
const YEAR = 60 * 60 * 24 * 365;

interface DataSaverState {
  on: boolean;
  pending: boolean;
  setOn: (on: boolean) => void;
}

const Ctx = createContext<DataSaverState>({ on: false, pending: false, setOn: () => {} });

function writeCookie(on: boolean) {
  try {
    document.cookie = `${COOKIE}=${on ? "1" : "0"}; path=/; max-age=${YEAR}; samesite=lax`;
  } catch {
    // Cookies blocked: the setting simply won't persist.
  }
}

export function DataSaverProvider({
  initialOn,
  hasChoice,
  children,
}: {
  initialOn: boolean;
  /** The student has already chosen (cookie set), so don't auto-detect. */
  hasChoice: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  // The server's value, unless the student has just flipped the switch.
  const [override, setOverride] = useState<boolean | null>(null);
  const on = override ?? initialOn;
  const [pending, startTransition] = useTransition();

  const setOn = useCallback(
    (next: boolean) => {
      setOverride(next);
      writeCookie(next);
      startTransition(() => router.refresh());
    },
    [router],
  );

  // No cookie yet and the browser says it is saving data: record that and
  // re-render on the server, which then sends the light markup.
  useEffect(() => {
    if (hasChoice || initialOn) return;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (!connection?.saveData) return;
    writeCookie(true);
    router.refresh();
  }, [hasChoice, initialOn, router]);

  return <Ctx.Provider value={{ on, pending, setOn }}>{children}</Ctx.Provider>;
}

export function useDataSaver() {
  return useContext(Ctx);
}

/** A labelled switch (role="switch"); used in the avatar menu and on Profile. */
export function DataSaverSwitch({ className, tone = "light" }: { className?: string; tone?: "light" | "night" }) {
  const { on, pending, setOn } = useDataSaver();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={pending}
      onClick={() => setOn(!on)}
      className={cn("flex min-h-11 w-full items-center justify-between gap-4 text-left", className)}
    >
      <span>
        <span className={cn("block text-[15px] font-bold", tone === "night" ? "text-white" : "text-ink")}>
          Data saver
        </span>
        <span className={cn("block text-[13px]", tone === "night" ? "text-on-night-muted" : "text-ink-3")}>
          Hide pictures to use less data
        </span>
      </span>
      <span
        aria-hidden="true"
        className={cn(
          "relative inline-flex h-7 w-12 shrink-0 rounded-full transition-colors",
          on ? "bg-kick-blue" : "bg-line-strong",
        )}
      >
        <span
          className={cn(
            "absolute top-1 left-1 size-5 rounded-full bg-white shadow transition-transform",
            on && "translate-x-5",
          )}
        />
      </span>
    </button>
  );
}

/** Full-width notice above the Home billboard while data saver is on (§9.1.7). */
export function DataSaverBanner() {
  const { on, pending, setOn } = useDataSaver();
  if (!on) return null;
  return (
    <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-saver-bg px-gutter py-2.5 text-sm font-bold text-saver-ink">
      <span>Data saver is on. Pictures stay hidden until you turn it off.</span>
      <button
        type="button"
        disabled={pending}
        onClick={() => setOn(false)}
        className="min-h-11 underline underline-offset-2 hover:no-underline"
      >
        Turn off
      </button>
    </div>
  );
}
