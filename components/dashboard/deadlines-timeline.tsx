import Link from "next/link";
import { cn } from "@/lib/utils";
import { Mono } from "@/components/ui/mono";

interface DeadlineItem {
  id: string;
  label: string;
  date: Date | null;
  dateText: string | null;
  daysRemaining: number | null;
  href: string;
}

export function DeadlinesTimeline({ deadlines }: { deadlines: DeadlineItem[] }) {
  if (deadlines.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-background p-6">
        <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Upcoming Deadlines
        </h3>
        <p className="mt-3 text-sm text-muted-foreground">No upcoming deadlines among your current matches.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-background p-6">
      <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Upcoming Deadlines</h3>
      <ol className="mt-4 space-y-1">
        {deadlines.map((d) => {
          const urgent = d.daysRemaining !== null && d.daysRemaining <= 14;
          return (
            <li key={d.id}>
              <Link
                href={d.href}
                className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 -mx-2 transition-colors hover:bg-muted"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{d.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.date ? d.date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : d.dateText}
                  </p>
                </div>
                {d.daysRemaining !== null && (
                  <Mono
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium tabular-nums",
                      urgent ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {d.daysRemaining === 0 ? "Today" : `${d.daysRemaining}d`}
                  </Mono>
                )}
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
