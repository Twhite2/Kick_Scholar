import { CircleAlert, CircleCheck, CircleHelp, ExternalLink, TrendingUp } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ComparisonRow } from "@/lib/ui/requirements";
import { factorLabel } from "@/lib/ui/requirements";
import { formatFullDate } from "@/lib/ui/format";

/** A white detail-page panel with its own heading and anchor (§9.3). */
export function Panel({
  id,
  title,
  icon,
  intro,
  children,
  className,
}: {
  id: string;
  title: React.ReactNode;
  icon?: React.ReactNode;
  intro?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cn("scroll-mt-28 rounded-panel bg-white p-5 shadow-hairline md:p-6", className)}>
      <h2 id={`${id}-title`} className="flex items-center gap-2 type-section-h2 text-ink">
        {icon}
        {title}
      </h2>
      {intro && <p className="mt-2 max-w-[70ch] type-body-sm text-ink-3">{intro}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export interface Fact {
  label: string;
  value: string;
  note?: string | null;
  noteTone?: "green" | "red" | "muted";
}

/** Tuition, length, starts, applications, taught in (§9.3). Empty facts are hidden. */
export function FactGrid({ facts, className }: { facts: Fact[]; className?: string }) {
  if (facts.length === 0) return null;
  return (
    <dl className={cn("grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]", className)}>
      {facts.map((f) => (
        <div key={f.label} className="rounded-tile bg-white px-4 py-3.5 shadow-hairline">
          <dt className="text-[13px] text-ink-3">{f.label}</dt>
          <dd className="mt-1 font-display text-xl leading-tight font-bold text-ink tabular-nums">{f.value}</dd>
          {f.note && (
            <dd
              className={cn(
                "mt-1 text-[13px]",
                f.noteTone === "green" && "font-bold text-green-text",
                f.noteTone === "red" && "font-bold text-kick-red",
                (!f.noteTone || f.noteTone === "muted") && "text-ink-3",
              )}
            >
              {f.note}
            </dd>
          )}
        </div>
      ))}
    </dl>
  );
}

const STATUS_WORD = { met: "Met", missing: "Not met", unknown: "Not checked" } as const;

/** Requirement | They ask for | You have, as a real table (§9.3). */
export function RequirementComparison({ rows }: { rows: ComparisonRow[] }) {
  if (rows.length === 0) {
    return <p className="type-body-sm text-ink-3">No structured requirements published yet.</p>;
  }
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[560px] table-fixed border-collapse text-left">
        <colgroup>
          <col style={{ width: 28 }} />
          <col style={{ width: "22%" }} />
          <col style={{ width: "44%" }} />
          <col />
        </colgroup>
        <thead>
          <tr className="text-[13px] font-bold text-ink-3">
            <th scope="col" className="pb-2.5">
              <span className="sr-only">Status</span>
            </th>
            <th scope="col" className="pb-2.5 pl-3.5">Requirement</th>
            <th scope="col" className="pb-2.5 pl-3.5">They ask for</th>
            <th scope="col" className="pb-2.5 pl-3.5">You have</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-line align-top">
              <td className="py-3.5">
                {r.status === "met" && <CircleCheck aria-hidden="true" className="size-5 text-kick-green" />}
                {r.status === "missing" && <CircleAlert aria-hidden="true" className="size-5 text-kick-red" />}
                {r.status === "unknown" && <CircleHelp aria-hidden="true" className="size-5 text-ink-3" />}
                <span className="sr-only">{STATUS_WORD[r.status]}</span>
              </td>
              <th scope="row" className="py-3.5 pl-3.5 text-[15px] font-bold text-ink">
                {r.label}
              </th>
              <td className="py-3.5 pl-3.5 text-[15px] break-words text-ink-2">{r.theyAsk}</td>
              <td className="py-3.5 pl-3.5 text-[15px] break-words">
                {r.youHave ? (
                  <span className="text-ink">{r.youHave}</span>
                ) : r.action ? (
                  <span className="flex flex-col items-start gap-1">
                    <span className="font-bold text-red-text">Not added yet</span>
                    <Link href={r.action.href} className="inline-flex min-h-11 items-center font-bold text-kick-blue underline-offset-2 hover:underline">
                      {r.action.label}
                    </Link>
                  </span>
                ) : (
                  <span className="text-ink-3">Check the official page</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Factor bars: ≥ 70 green, 40–69 blue, < 40 red, not scorable grey (§9.3). */
export function ScoreBreakdown({
  factors,
}: {
  factors: Array<{ factor: string; score: number | null; explanation: string }>;
}) {
  if (factors.length === 0) return null;
  return (
    <div className="grid gap-x-6 gap-y-4 [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))]">
      {factors.map((f) => {
        const color = f.score === null ? "" : f.score >= 70 ? "bg-kick-green" : f.score >= 40 ? "bg-kick-blue" : "bg-kick-red";
        return (
          <div key={f.factor}>
            <div className="flex items-baseline justify-between gap-3 text-[15px]">
              <span className="font-bold text-ink">{factorLabel(f.factor)}</span>
              <span className={cn("tabular-nums", f.score === null ? "text-ink-3" : "font-bold text-ink")}>
                {f.score === null ? "N/A" : `${f.score}%`}
              </span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-track" aria-hidden="true">
              {f.score !== null && <div className={cn("h-full rounded-full", color)} style={{ width: `${Math.max(f.score, 2)}%` }} />}
            </div>
            <p className="mt-1.5 text-[13px] leading-snug text-ink-3">{f.explanation}</p>
          </div>
        );
      })}
    </div>
  );
}

/** "What's holding your score back" and "What you can do" (§9.3). */
export function AdviceLists({
  blockers,
  actions,
}: {
  blockers: string[];
  actions: Array<{ text: string; href: string }>;
}) {
  if (blockers.length === 0 && actions.length === 0) return null;
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {blockers.length > 0 && (
        <div>
          <h3 className="flex items-center gap-2 text-base font-bold text-ink">
            <CircleAlert aria-hidden="true" className="size-5 text-kick-red" />
            What&apos;s holding your score back
          </h3>
          <ul role="list" className="mt-3 space-y-2">
            {blockers.map((b) => (
              <li key={b} className="rounded-xl bg-red-tint px-3 py-2.5 text-sm leading-[1.4] text-red-deep">
                {b}
              </li>
            ))}
          </ul>
        </div>
      )}
      {actions.length > 0 && (
        <div>
          <h3 className="flex items-center gap-2 text-base font-bold text-ink">
            <TrendingUp aria-hidden="true" className="size-5 text-kick-blue" />
            What you can do
          </h3>
          <ul role="list" className="mt-3 space-y-2">
            {actions.map((a) => (
              <li key={a.text}>
                <Link
                  href={a.href}
                  className="flex min-h-11 items-center rounded-xl bg-blue-tint px-3 py-2.5 text-sm font-bold text-kick-blue hover:underline"
                >
                  {a.text}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export interface KeyDate {
  label: string;
  date: string | null; // ISO
  text?: string | null;
}

/** Vertical timeline from today through every real deadline (§9.3). */
export function KeyDates({ dates, intakes, now }: { dates: KeyDate[]; intakes: string[]; now: Date }) {
  const dated = dates.filter((d) => d.date).sort((a, b) => a.date!.localeCompare(b.date!));
  const undated = dates.filter((d) => !d.date && d.text);
  const nowIso = now.toISOString();
  return (
    <section aria-labelledby="dates-title" className="rounded-panel bg-white p-5 shadow-hairline md:p-6">
      <h2 id="dates-title" className="font-display text-xl font-bold text-ink">
        Key dates
      </h2>
      <ol className="mt-4 space-y-0">
        <TimelineItem
          filled
          label="You are here"
          date={`Today, ${formatFullDate(now).replace(/ \d{4}$/, "")}`}
          last={dated.length === 0}
        />
        {dated.map((d, i) => (
          <TimelineItem
            key={`${d.label}-${d.date}`}
            label={d.label}
            date={formatFullDate(d.date!)}
            past={d.date! < nowIso}
            last={i === dated.length - 1}
          />
        ))}
      </ol>
      {(undated.length > 0 || intakes.length > 0) && (
        <div className="mt-4 space-y-1.5 border-t border-line pt-4 text-sm text-ink-2">
          {intakes.length > 0 && (
            <p>
              <span className="font-bold">Intakes:</span> {intakes.join(", ")}
            </p>
          )}
          {undated.map((d) => (
            <p key={`${d.label}-${d.text}`}>
              <span className="font-bold">{d.label}:</span> {d.text}
            </p>
          ))}
        </div>
      )}
      {dated.length === 0 && undated.length === 0 && (
        <p className="mt-3 text-sm text-ink-3">No deadlines are published yet.</p>
      )}
    </section>
  );
}

function TimelineItem({
  label,
  date,
  filled,
  past,
  last,
}: {
  label: string;
  date: string;
  filled?: boolean;
  past?: boolean;
  last?: boolean;
}) {
  return (
    <li className={cn("relative pl-7", last ? "pb-0" : "pb-5")}>
      {!last && <span aria-hidden="true" className="absolute top-2 bottom-0 left-[6px] w-px bg-line" />}
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-1.5 left-0 size-[13px] rounded-full border-2",
          filled ? "border-kick-blue bg-kick-blue" : past ? "border-line-strong bg-white" : "border-kick-blue bg-white",
        )}
      />
      <p className={cn("text-[15px] font-bold", past ? "text-ink-3" : "text-ink")}>{date}</p>
      <p className={cn("text-sm", past ? "text-ink-3" : "text-ink-2")}>
        {label}
        {past && <span className="sr-only"> (passed)</span>}
      </p>
    </li>
  );
}

/** "Where this comes from" (§9.3). */
export function ProvenanceCard({
  sourceName,
  sourceUrl,
  checkedAt,
  officialUrl,
  subject,
}: {
  sourceName: string;
  sourceUrl: string;
  checkedAt: Date | null;
  officialUrl?: string | null;
  subject: string;
}) {
  const support = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
  return (
    <section aria-labelledby="source-title" className="rounded-panel bg-white p-5 shadow-hairline md:p-6">
      <h2 id="source-title" className="font-display text-xl font-bold text-ink">
        Where this comes from
      </h2>
      <p className="mt-3 text-[15px] text-ink-2">
        Sourced from the {sourceName} page.
        {checkedAt && <> Last checked on {formatFullDate(checkedAt)}.</>}
      </p>
      <div className="mt-3 flex flex-col items-start gap-1">
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-1.5 font-bold text-kick-blue hover:underline"
        >
          View the source page <ExternalLink aria-hidden="true" className="size-4" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
        {officialUrl && officialUrl !== sourceUrl && (
          <a
            href={officialUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-1.5 font-bold text-kick-blue hover:underline"
          >
            Official source <ExternalLink aria-hidden="true" className="size-4" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        )}
        {support && (
          <a
            href={`mailto:${support}?subject=${encodeURIComponent(`Something wrong: ${subject}`)}`}
            className="inline-flex min-h-11 items-center text-[15px] text-ink-3 underline underline-offset-2 hover:text-ink"
          >
            Report something wrong
          </a>
        )}
      </div>
    </section>
  );
}
