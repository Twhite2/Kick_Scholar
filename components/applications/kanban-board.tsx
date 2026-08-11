import { ApplicationCard, type ApplicationCardData } from "./application-card";

const COLUMNS: Array<{ status: string; label: string }> = [
  { status: "SAVED", label: "Saved" },
  { status: "PLANNING", label: "Planning" },
  { status: "IN_PROGRESS", label: "In Progress" },
  { status: "SUBMITTED", label: "Submitted" },
  { status: "ACCEPTED", label: "Accepted" },
  { status: "REJECTED", label: "Rejected" },
];

const MOVABLE_ORDER = ["SAVED", "PLANNING", "IN_PROGRESS", "SUBMITTED", "ACCEPTED"];

export function KanbanBoard({ applications }: { applications: ApplicationCardData[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
      {COLUMNS.map((col) => {
        const items = applications.filter((a) => a.status === col.status);
        const colorClass =
          col.status === "ACCEPTED" ? "text-success" : col.status === "REJECTED" ? "text-destructive" : "text-muted-foreground";
        return (
          <div key={col.status} className="min-w-0">
            <h3 className={`text-xs font-semibold tracking-wide uppercase ${colorClass}`}>
              {col.label} <span className="font-normal">({items.length})</span>
            </h3>
            <div className="mt-2 space-y-2">
              {items.map((app) => {
                const idx = MOVABLE_ORDER.indexOf(app.status);
                return (
                  <ApplicationCard
                    key={app.id}
                    application={app}
                    canMoveBack={idx > 0}
                    canMoveForward={idx >= 0 && idx < MOVABLE_ORDER.length - 1}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
