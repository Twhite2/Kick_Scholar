"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Columns2, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { InstitutionLogo } from "./institution-logo";

/**
 * Compare up to three programmes (docs/ui-remodel.md §9.6). The selection
 * is a per-viewer convenience, so it lives in localStorage — wrapped, because
 * storage can be blocked or empty in private windows.
 */

export interface CompareItem {
  id: string;
  title: string;
  institution: { id: string; name: string; logoUrl: string | null; acronym: string | null };
}

const KEY = "ks-compare-program";
const MAX = 3;

interface CompareState {
  items: CompareItem[];
  has: (id: string) => boolean;
  toggle: (item: CompareItem) => void;
  remove: (id: string) => void;
  clear: () => void;
  full: boolean;
}

const Ctx = createContext<CompareState | null>(null);

function read(): CompareItem[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as CompareItem[]).slice(0, MAX) : [];
  } catch {
    return [];
  }
}

function write(items: CompareItem[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // Storage unavailable: the tray still works for this page view.
  }
}

export function CompareProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CompareItem[]>([]);

  // Hydrate after mount so server and first client render agree.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading an external store once on mount
    setItems(read());
  }, []);

  const update = useCallback((next: CompareItem[]) => {
    setItems(next);
    write(next);
  }, []);

  const value = useMemo<CompareState>(
    () => ({
      items,
      has: (id) => items.some((i) => i.id === id),
      toggle: (item) =>
        update(
          items.some((i) => i.id === item.id)
            ? items.filter((i) => i.id !== item.id)
            : items.length >= MAX
              ? items
              : [...items, item],
        ),
      remove: (id) => update(items.filter((i) => i.id !== id)),
      clear: () => update([]),
      full: items.length >= MAX,
    }),
    [items, update],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCompare(): CompareState | null {
  return useContext(Ctx);
}

/** 44px outline icon button: add to or remove from the comparison. */
export function CompareButton({ item, className }: { item: CompareItem; className?: string }) {
  const compare = useCompare();
  if (!compare) return null;
  const selected = compare.has(item.id);
  const disabled = !selected && compare.full;
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`Compare ${item.title}`}
      title={disabled ? "You can compare up to three programmes" : undefined}
      disabled={disabled}
      onClick={() => compare.toggle(item)}
      className={cn(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-full border transition-colors disabled:opacity-40",
        selected
          ? "border-kick-blue bg-blue-tint text-kick-blue"
          : "border-line-strong bg-white text-ink hover:border-kick-blue hover:text-kick-blue",
        className,
      )}
    >
      <Columns2 aria-hidden="true" className="size-[18px]" />
    </button>
  );
}

/** Fixed tray above the tab bar, shown once something is selected. */
export function CompareTray() {
  const compare = useCompare();
  const pathname = usePathname();
  if (!compare || compare.items.length === 0 || pathname?.startsWith("/compare")) return null;
  const { items, remove } = compare;
  const href = `/compare?type=program&ids=${items.map((i) => encodeURIComponent(i.id)).join(",")}`;

  return (
    <div
      role="region"
      aria-label="Compare programmes"
      className="fixed inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-40 px-3 md:bottom-6"
    >
      <div className="mx-auto flex max-w-[960px] flex-wrap items-center gap-3 rounded-panel bg-night px-[18px] py-3.5 text-white shadow-raised">
        <span className="font-display text-lg font-bold">Compare</span>
        <ul className="flex min-w-0 flex-1 flex-wrap items-center gap-2" role="list">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex max-w-[260px] min-w-0 items-center gap-2 rounded-full bg-white/10 py-1 pr-1 pl-1.5"
            >
              <InstitutionLogo
                name={item.institution.name}
                logoUrl={item.institution.logoUrl}
                acronym={item.institution.acronym}
                seed={item.institution.id}
                size={32}
                surface="image"
              />
              <span className="min-w-0 truncate text-sm font-bold">{item.title}</span>
              <button
                type="button"
                onClick={() => remove(item.id)}
                aria-label={`Remove ${item.title} from comparison`}
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-white/15"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </li>
          ))}
          {items.length < MAX && (
            <li className="hidden items-center gap-1.5 rounded-full border border-dashed border-white/35 px-3 py-2 text-sm text-on-night-muted sm:flex">
              <Plus aria-hidden="true" className="size-4" />
              Add one more
            </li>
          )}
        </ul>
        <Link
          href={href}
          className={cn(
            "inline-flex h-11 items-center rounded-full bg-white px-5 text-[15px] font-bold text-ink hover:bg-[#E3EBF4]",
            items.length < 2 && "pointer-events-none opacity-60",
          )}
          aria-disabled={items.length < 2}
          tabIndex={items.length < 2 ? -1 : undefined}
        >
          {items.length < 2 ? "Add another to compare" : `Compare ${items.length}`}
        </Link>
      </div>
    </div>
  );
}
