import { getDataQuality } from "@/lib/admin/getDataQuality";
import { Card, CardContent } from "@/components/ui/card";
import { Mono } from "@/components/ui/mono";
import { cn } from "@/lib/utils";

function StatTile({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "warning" | "success" }) {
  return (
    <Card>
      <CardContent className="p-5">
        <Mono
          className={cn(
            "block text-2xl font-semibold tabular-nums",
            tone === "warning" && "text-destructive",
            tone === "success" && "text-success",
          )}
        >
          {value}
        </Mono>
        <span className="text-sm text-muted-foreground">{label}</span>
      </CardContent>
    </Card>
  );
}

export default async function AdminDataQualityPage() {
  const q = await getDataQuality();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Catalog Size</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <StatTile label="Universities" value={q.totalUniversities} />
          <StatTile label="Programs" value={q.totalPrograms} />
          <StatTile label="Scholarships" value={q.totalScholarships} />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Verification</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <StatTile label="Verified Programs" value={q.verifiedPrograms} tone="success" />
          <StatTile label="Unverified Programs" value={q.unverifiedPrograms} tone="warning" />
          <StatTile label="Scholarships Pending Verification" value={q.scholarshipsPendingVerification} tone="warning" />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Completeness Gaps</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <StatTile label="Programs Missing Tuition" value={q.programsMissingTuition} tone="warning" />
          <StatTile label="Programs Missing Deadlines" value={q.programsMissingDeadlines} tone="warning" />
          <StatTile label="Programs Missing Requirements" value={q.programsMissingRequirements} tone="warning" />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">Sources</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <StatTile label="Total Sources" value={q.totalSources} />
          <StatTile label="Active" value={q.activeSources} tone="success" />
          <StatTile label="Paused" value={q.pausedSources} tone="warning" />
        </div>
      </div>
    </div>
  );
}
