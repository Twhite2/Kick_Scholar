"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select } from "@base-ui/react/select";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Catalogue controls (docs/ui-remodel.md §9.6). Every control writes the same
 * URL keys the old selects did, so links keep working; changing anything
 * resets the page number.
 */

function useParamUpdater() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const update = useCallback(
    (changes: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("page");
      params.delete("focus");
      for (const [key, value] of Object.entries(changes)) {
        if (value === null || value === "" || value === "all") params.delete(key);
        else params.set(key, value);
      }
      const qs = params.toString();
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    },
    [pathname, router, searchParams],
  );

  return { update, isPending, searchParams };
}

/**
 * 48px search with a 300ms debounce: one request per pause in typing, not
 * per keystroke. A hidden live region says "Searching…" and then the count.
 */
export function SearchBox({
  label,
  placeholder,
  resultLabel,
}: {
  label: string;
  placeholder: string;
  /** "1,412 programmes" — announced when a search settles. */
  resultLabel: string;
}) {
  const { update, isPending, searchParams } = useParamUpdater();
  const urlQ = searchParams.get("q") ?? "";
  const [value, setValue] = useState(urlQ);
  const [knownQ, setKnownQ] = useState(urlQ);
  const [pushed, setPushed] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  // The URL changed without us (e.g. "Clear all"): follow it.
  if (urlQ !== knownQ) {
    setKnownQ(urlQ);
    if (urlQ !== pushed) setValue(urlQ);
  }

  useEffect(() => {
    if (searchParams.get("focus") === "search") input.current?.focus();
    // Only on first mount: the focus flag is dropped by the first update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const next = value.trim();
    if (next === knownQ.trim()) return;
    const t = window.setTimeout(() => {
      setPushed(next);
      setSearched(true);
      update({ q: next || null });
    }, 300);
    return () => window.clearTimeout(t);
  }, [value, knownQ, update]);

  return (
    <div className="relative w-full">
      <label htmlFor="catalogue-search" className="sr-only">
        {label}
      </label>
      <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink-3" />
      <input
        ref={input}
        id="catalogue-search"
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="h-12 w-full rounded-full border border-line-strong bg-white pr-4 pl-12 text-base text-ink placeholder:text-ink-3 hover:border-ink-3 focus-visible:border-kick-blue"
      />
      <p className="sr-only" aria-live="polite">
        {isPending ? "Searching…" : searched ? resultLabel : ""}
      </p>
    </div>
  );
}

export interface ChipOption {
  value: string;
  label: string;
}

const chipBase =
  "inline-flex h-11 items-center gap-1.5 rounded-full border text-[15px] font-bold whitespace-nowrap transition-colors select-none";

/** A filter as a chip that opens a list; active chips show their value and an X (§9.6). */
export function FilterChip({
  paramKey,
  label,
  options,
}: {
  paramKey: string;
  label: string;
  options: ChipOption[];
}) {
  const { update, searchParams } = useParamUpdater();
  const value = searchParams.get(paramKey);
  const items = Object.fromEntries(options.map((o) => [o.value, o.label]));
  const active = value !== null && value in items;

  return (
    <div className="inline-flex items-center">
      <Select.Root
        value={active ? value : null}
        onValueChange={(v) => update({ [paramKey]: (v as string | null) ?? null })}
        items={items}
      >
        <Select.Trigger
          aria-label={active ? `${label}: ${items[value!]}. Change ${label.toLowerCase()}` : `Filter by ${label.toLowerCase()}`}
          className={cn(
            chipBase,
            active
              ? "border-blue-tint bg-blue-tint pr-11 pl-4 text-kick-blue"
              : "border-line-strong bg-white pr-3 pl-4 text-ink hover:border-kick-blue",
          )}
        >
          {active ? `${label}: ${items[value!]}` : label}
          {!active && <ChevronDown aria-hidden="true" className="size-4 text-ink-3" />}
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner sideOffset={6} alignItemWithTrigger={false} className="z-50">
            <Select.Popup className="max-h-[min(420px,var(--available-height))] min-w-[220px] overflow-y-auto rounded-2xl bg-white p-1.5 shadow-raised outline-none">
              {options.map((o) => (
                <Select.Item
                  key={o.value}
                  value={o.value}
                  className="flex min-h-11 cursor-default items-center justify-between gap-3 rounded-xl px-3 text-[15px] text-ink outline-none select-none data-highlighted:bg-blue-tint data-highlighted:text-kick-blue data-selected:font-bold"
                >
                  <Select.ItemText>{o.label}</Select.ItemText>
                  <Select.ItemIndicator>
                    <Check aria-hidden="true" className="size-4" />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
      {active && (
        <button
          type="button"
          onClick={() => update({ [paramKey]: null })}
          aria-label={`Clear ${label.toLowerCase()} filter`}
          className="relative z-10 -ml-10 inline-flex size-9 items-center justify-center rounded-full text-kick-blue hover:bg-white/70"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      )}
    </div>
  );
}

/** "I qualify": only opportunities that aren't missing a requirement. */
export function QualifyChip() {
  const { update, searchParams } = useParamUpdater();
  const on = searchParams.get("qualify") === "1";
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => update({ qualify: on ? null : "1" })}
      className={cn(
        chipBase,
        "px-4",
        on ? "border-green-tint bg-green-tint text-green-text" : "border-line-strong bg-white text-ink hover:border-kick-blue",
      )}
    >
      {on && <Check aria-hidden="true" className="size-4" />}I qualify
    </button>
  );
}

/** Text button shown when any filter is active. */
export function ClearAll({ keys }: { keys: string[] }) {
  const { update, searchParams } = useParamUpdater();
  if (!keys.some((k) => searchParams.get(k))) return null;
  return (
    <button
      type="button"
      onClick={() => update(Object.fromEntries(keys.map((k) => [k, null])))}
      className="inline-flex min-h-11 items-center px-2 text-[15px] font-bold text-kick-blue underline-offset-2 hover:underline"
    >
      Clear all
    </button>
  );
}

/** Sort stays a select, with today's options. */
export function SortSelect({ options, fallback }: { options: ChipOption[]; fallback: string }) {
  const { update, searchParams } = useParamUpdater();
  const raw = searchParams.get("sort") ?? fallback;
  const value = raw === "best" ? "match" : raw;
  const items = Object.fromEntries(options.map((o) => [o.value, o.label]));
  return (
    <Select.Root value={value in items ? value : fallback} onValueChange={(v) => update({ sort: v === fallback ? null : (v as string) })} items={items}>
      <Select.Trigger className={cn(chipBase, "border-line-strong bg-white pr-3 pl-4 text-ink hover:border-kick-blue")}>
        <span className="font-normal text-ink-3">Sort:</span>
        <Select.Value />
        <ChevronDown aria-hidden="true" className="size-4 text-ink-3" />
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner sideOffset={6} alignItemWithTrigger={false} align="end" className="z-50">
          <Select.Popup className="min-w-[220px] rounded-2xl bg-white p-1.5 shadow-raised outline-none">
            {options.map((o) => (
              <Select.Item
                key={o.value}
                value={o.value}
                className="flex min-h-11 cursor-default items-center justify-between gap-3 rounded-xl px-3 text-[15px] text-ink outline-none select-none data-highlighted:bg-blue-tint data-highlighted:text-kick-blue data-selected:font-bold"
              >
                <Select.ItemText>{o.label}</Select.ItemText>
                <Select.ItemIndicator>
                  <Check aria-hidden="true" className="size-4" />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
