import { AlertCircle } from "lucide-react";

export function MissingRequirementCard({
  label,
  affectedCount,
  recommendedAction,
}: {
  label: string;
  affectedCount: number;
  recommendedAction: string | null;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-background p-4">
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertCircle className="size-4" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Affects {affectedCount} {affectedCount === 1 ? "match" : "matches"}
        </p>
        {recommendedAction && <p className="mt-1.5 text-xs font-medium text-kick-blue">{recommendedAction}</p>}
      </div>
    </div>
  );
}
