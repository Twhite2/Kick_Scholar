"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { CountryFlag } from "@/components/kick/country-flag";
import { MAX_QUERY, MIN_QUERY, searchTarget, type Suggestions } from "@/lib/search/shared";

/**
 * The search field in the top bar. Typing shows matching programmes,
 * universities and scholarships under the field; arrow keys move through
 * them, Enter opens one, and Enter on its own searches the catalogue of the
 * section the student is in. From 1280px wide the field sits in the bar;
 * narrower, a search button opens it as a full-screen sheet.
 */
export function HeaderSearch({ night, pathname }: { night: boolean; pathname: string }) {
  const [sheet, setSheet] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);

  // A sheet left open by browser back/forward closes with the page change.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setSheet(false);
  }

  const closeSheet = () => {
    setSheet(false);
    trigger.current?.focus();
  };

  return (
    <>
      <div className="relative hidden xl:block">
        <SearchCombobox variant="inline" night={night} pathname={pathname} />
      </div>
      <button
        ref={trigger}
        type="button"
        onClick={() => setSheet(true)}
        aria-label="Search"
        aria-haspopup="dialog"
        aria-expanded={sheet}
        className={cn(
          "inline-flex size-11 items-center justify-center rounded-full xl:hidden",
          night ? "text-white hover:bg-white/10" : "text-ink hover:bg-grey-tint",
        )}
      >
        <Search aria-hidden="true" className="size-5" />
      </button>
      {sheet && <SearchSheet pathname={pathname} onClose={closeSheet} />}
    </>
  );
}

/** The phone and tablet search: a full-screen sheet over the page. */
function SearchSheet({ pathname, onClose }: { pathname: string; onClose: () => void }) {
  const cancel = useRef<HTMLButtonElement>(null);

  // The page behind doesn't scroll while the sheet is open.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search"
      className="fixed inset-0 z-50 flex flex-col bg-white text-ink xl:hidden"
      onKeyDown={(e) => {
        // Keep Tab inside the sheet: the field and Cancel are its only stops.
        if (e.key !== "Tab") return;
        const input = e.currentTarget.querySelector("input");
        if (!e.shiftKey && document.activeElement === cancel.current) {
          e.preventDefault();
          input?.focus();
        } else if (e.shiftKey && document.activeElement === input) {
          e.preventDefault();
          cancel.current?.focus();
        }
      }}
    >
      <SearchCombobox variant="sheet" night={false} pathname={pathname} onDone={onClose}>
        <button
          ref={cancel}
          type="button"
          onClick={onClose}
          className="inline-flex min-h-11 shrink-0 items-center px-2 text-[15px] font-bold text-varsity-blue"
        >
          Cancel
        </button>
      </SearchCombobox>
    </div>,
    document.body,
  );
}

const GROUPS = [
  { key: "programmes", title: "Programmes", one: "programme", many: "programmes" },
  { key: "universities", title: "Universities", one: "university", many: "universities" },
  { key: "scholarships", title: "Scholarships", one: "scholarship", many: "scholarships" },
] as const;

interface Option {
  key: string;
  href: string;
  kind: "item" | "all";
  label: string;
  detail?: string;
  country?: string | null;
}

function placeholderFor(pathname: string) {
  if (pathname.startsWith("/scholarships")) return "Search scholarships";
  if (pathname.startsWith("/institutions")) return "Search universities";
  return "Search programmes or universities";
}

function SearchCombobox({
  variant,
  night,
  pathname,
  onDone,
  children,
}: {
  variant: "inline" | "sheet";
  night: boolean;
  pathname: string;
  /** Called after the student picks a result or searches (closes the sheet). */
  onDone?: () => void;
  /** Rendered beside the field (the sheet's Cancel button). */
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const inputId = useId();
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);

  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(variant === "sheet");
  const [dismissed, setDismissed] = useState(false);
  // Results by query; "error" when that query failed. The last settled query
  // keeps its results on screen while the next one loads, so nothing flickers.
  const [results, setResults] = useState<Record<string, Suggestions | "error">>({});
  const [settled, setSettled] = useState("");
  const [active, setActive] = useState({ key: "", index: -1 });

  const q = value.trim();
  const key = q.toLowerCase();
  const long = q.length >= MIN_QUERY;
  const entry = long ? results[key] : undefined;
  const status = !long ? "idle" : entry === undefined ? "loading" : entry === "error" ? "error" : "done";
  const fallback = results[settled];
  const shown: Suggestions | null =
    entry && entry !== "error" ? entry : status === "loading" && fallback && fallback !== "error" ? fallback : null;
  const shownKey = shown ? shown.q.toLowerCase() : "";
  const stale = shown !== null && shownKey !== key;

  // A page change (a pick, a search, the browser's back button) clears the field.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setValue("");
    setDismissed(true);
  }

  useEffect(() => {
    if (!long || results[key] !== undefined) return;
    // One request per pause in typing; a newer query cancels the older one.
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      let data: Suggestions | "error" = "error";
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        if (res.ok) data = (await res.json()) as Suggestions;
      } catch {
        if (controller.signal.aborted) return;
      }
      setResults((r) => ({ ...r, [key]: data }));
      if (data !== "error") setSettled(key);
    }, 200);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [long, key, q, results]);

  const options: Option[] = [];
  const sections = shown
    ? GROUPS.map((g) => ({ g, group: shown[g.key] })).filter(({ group }) => group.total > 0)
    : [];
  const sectionOptions = sections.map(({ g, group }) => {
    const start = options.length;
    for (const item of group.items) {
      options.push({ key: `${g.key}-${item.id}`, href: item.href, kind: "item", label: item.name, detail: item.detail, country: item.country });
    }
    if (group.total > group.items.length) {
      options.push({
        key: `${g.key}-all`,
        href: group.href,
        kind: "all",
        label: `See all ${group.total.toLocaleString("en-GB")} ${group.total === 1 ? g.one : g.many}`,
      });
    }
    return { g, start, end: options.length };
  });

  const activeIndex = active.key === shownKey && active.index < options.length ? active.index : -1;
  const optionId = (i: number) => `${listId}-option-${i}`;
  const open = variant === "sheet" ? long : focused && !dismissed && long;

  useEffect(() => {
    if (activeIndex >= 0) document.getElementById(optionId(activeIndex))?.scrollIntoView({ block: "nearest" });
    // optionId only depends on listId, which never changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  const finish = () => {
    setValue("");
    setDismissed(true);
    input.current?.blur();
    onDone?.();
  };

  const go = (href: string) => {
    router.push(href);
    finish();
  };

  const move = (step: 1 | -1) => {
    if (!options.length) return;
    setDismissed(false);
    const next = activeIndex < 0 ? (step === 1 ? 0 : options.length - 1) : activeIndex + step;
    setActive({ key: shownKey, index: next < 0 || next >= options.length ? -1 : next });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      move(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      move(-1);
    } else if (e.key === "Enter" && open && activeIndex >= 0) {
      e.preventDefault();
      go(options[activeIndex].href);
    } else if (e.key === "Escape") {
      if (variant === "sheet") {
        e.preventDefault();
        onDone?.();
      } else if (open) {
        e.preventDefault();
        setDismissed(true);
      } else if (value) {
        e.preventDefault();
        setValue("");
      }
    }
  };

  const announcement =
    status === "done" ? (options.length ? `${options.length} suggestions. Use the arrow keys to choose one.` : "No matches.") : "";

  const list = open && (
    <div
      id={listId}
      role="listbox"
      aria-label="Search suggestions"
      // Keep focus in the field while a suggestion is clicked.
      onMouseDown={(e) => e.preventDefault()}
      className={cn(
        "overflow-y-auto bg-white text-ink transition-opacity",
        stale && "opacity-60",
        variant === "inline"
          ? "absolute top-[calc(100%+8px)] right-0 max-h-[min(70vh,560px)] w-[440px] rounded-panel border border-line py-2 shadow-raised"
          : "flex-1 pb-[env(safe-area-inset-bottom)]",
      )}
    >
      {!shown && status === "loading" && <p className="px-4 py-3 text-[15px] text-ink-3">Searching…</p>}
      {!shown && status === "error" && (
        <p className="px-4 py-3 text-[15px] text-ink-3">Suggestions aren&apos;t available right now. Press Enter to search.</p>
      )}
      {shown && sections.length === 0 && status !== "loading" && (
        <p className="px-4 py-3 text-[15px] text-ink-3">
          No programmes, universities or scholarships match &ldquo;{shown.q}&rdquo;.
        </p>
      )}
      {sectionOptions.map(({ g, start, end }) => (
        <div key={g.key} role="group" aria-labelledby={`${listId}-${g.key}`} className="py-1">
          <div id={`${listId}-${g.key}`} className="px-4 pt-2 pb-1 text-[13px] font-bold text-ink-3">
            {g.title}
          </div>
          {options.slice(start, end).map((o, j) => {
            const i = start + j;
            return (
              <Link
                key={o.key}
                id={optionId(i)}
                href={o.href}
                role="option"
                aria-selected={i === activeIndex}
                tabIndex={-1}
                onMouseMove={() => i !== activeIndex && setActive({ key: shownKey, index: i })}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                  finish();
                }}
                className={cn(
                  "flex items-center gap-3 px-4",
                  o.kind === "item" ? "min-h-14 py-2" : "min-h-11 text-[14px] font-bold text-varsity-blue",
                  i === activeIndex && "bg-blue-tint",
                )}
              >
                {o.kind === "item" ? (
                  <>
                    <CountryFlag code={o.country} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-bold">{o.label}</span>
                      {o.detail && <span className="block truncate text-[13px] text-ink-3">{o.detail}</span>}
                    </span>
                  </>
                ) : (
                  <>
                    {o.label}
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </div>
  );

  return (
    <div
      className={cn(variant === "sheet" && "flex min-h-0 flex-1 flex-col")}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      <div
        className={cn(
          variant === "sheet" && "flex h-16 shrink-0 items-center gap-2 border-b border-line px-gutter md:h-20",
        )}
      >
        <form
          role="search"
          action={searchTarget(pathname, "")}
          method="get"
          onSubmit={(e) => {
            e.preventDefault();
            if (q) go(searchTarget(pathname, q));
          }}
          className={cn("group/search relative", variant === "inline" ? "w-[300px]" : "flex-1")}
        >
          <label htmlFor={inputId} className="sr-only">
            Search programmes, universities and scholarships
          </label>
          <Search
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-ink-3",
              night && "text-[#D5E0EC] group-focus-within/search:text-ink-3",
            )}
          />
          <input
            ref={input}
            id={inputId}
            name="q"
            type="search"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={listId}
            aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
            autoComplete="off"
            autoFocus={variant === "sheet"}
            enterKeyHint="search"
            maxLength={MAX_QUERY}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setDismissed(false);
            }}
            onKeyDown={onKeyDown}
            placeholder={placeholderFor(pathname)}
            className={cn(
              "h-11 w-full rounded-full border pr-4 pl-11 text-[15px] transition-colors",
              night
                ? "border-transparent bg-white/10 text-white placeholder:text-[#D5E0EC] hover:bg-white/15 focus:bg-white focus:text-ink focus:placeholder:text-ink-3"
                : "border-line-strong bg-white text-ink placeholder:text-ink-3 hover:border-ink-3 focus-visible:border-varsity-blue",
            )}
          />
        </form>
        {children}
      </div>
      {variant === "inline" ? list : list || <p className="px-gutter py-4 text-[15px] text-ink-3">Find a programme, university or scholarship by name.</p>}
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}
