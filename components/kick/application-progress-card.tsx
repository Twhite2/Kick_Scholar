import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ApplicationStage, ApplicationSummary } from "@/lib/types/cards";
import { formatDate } from "@/lib/ui/format";
import { InstitutionLogo } from "./institution-logo";

export const STAGE_LABEL: Record<ApplicationStage, string> = {
  SAVED: "Saved",
  PLANNING: "Planning",
  IN_PROGRESS: "In progress",
  SUBMITTED: "Submitted",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
};

const STAGE_CLASS: Record<ApplicationStage, string> = {
  SAVED: "bg-grey-tint text-slate",
  PLANNING: "bg-grey-tint text-slate",
  IN_PROGRESS: "bg-blue-tint text-kick-blue",
  SUBMITTED: "bg-green-tint text-green-text",
  ACCEPTED: "bg-green-tint text-green-text",
  REJECTED: "bg-red-tint text-red-text",
  WITHDRAWN: "bg-grey-tint text-slate",
};

export function StagePill({ stage }: { stage: ApplicationStage }) {
  return (
    <span className={cn("inline-flex h-7 shrink-0 items-center rounded-full px-2.5 type-caption", STAGE_CLASS[stage])}>
      {STAGE_LABEL[stage]}
    </span>
  );
}

/** "Pick up where you left off" (docs/ui-remodel.md §9.1.3). */
export function ApplicationProgressCard({ app, now = new Date() }: { app: ApplicationSummary; now?: Date }) {
  const inst = app.institution;
  const pct = app.total > 0 ? Math.round((app.done / app.total) * 100) : 0;
  return (
    <article className="flex flex-col gap-3.5 rounded-poster bg-white p-[18px] shadow-hairline">
      <div className="flex items-start gap-3">
        {inst && <InstitutionLogo name={inst.name} logoUrl={inst.logoUrl} acronym={inst.acronym} seed={inst.id} size={44} />}
        <div className="min-w-0 flex-1">
          <h3 className="type-card-title clamp-2 text-ink">{app.title}</h3>
          <p className="truncate type-meta text-ink-3">{app.organisation}</p>
        </div>
        <StagePill stage={app.stage} />
      </div>
      <div>
        <div className="flex items-baseline justify-between gap-3 type-meta">
          <span className="font-bold text-ink tabular-nums">
            {app.total > 0 ? `${app.done} of ${app.total} documents ready` : "No checklist yet"}
          </span>
          {app.deadline && <span className="shrink-0 text-ink-3">Closes {formatDate(app.deadline, now)}</span>}
        </div>
        <div
          className="mt-2 h-2 overflow-hidden rounded-full bg-track"
          role="progressbar"
          aria-label="Documents ready"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
        >
          <div className="h-full rounded-full bg-kick-blue" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 type-meta text-ink-2">
          <span className="font-bold">Next:</span>{" "}
          {app.total > 0 ? (app.next ?? "submit your application") : "add your document checklist"}
        </p>
        <Link
          href={`/plan?tab=applications#app-${app.id}`}
          className="inline-flex h-11 shrink-0 items-center rounded-full bg-blue-tint px-5 text-[15px] font-bold text-kick-blue hover:bg-[#d6e6f5]"
        >
          Continue<span className="sr-only"> with {app.title}</span>
        </Link>
      </div>
    </article>
  );
}
