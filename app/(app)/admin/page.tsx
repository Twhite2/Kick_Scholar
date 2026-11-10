import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth-guards";
import { getDataQuality } from "@/lib/admin/getDataQuality";
import { formatCount } from "@/lib/ui/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Data quality" };

function StatTile({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "warning" | "success" }) {
  return (
    <div className="rounded-tile bg-white px-5 py-4 shadow-hairline">
      <p
        className={cn(
          "font-display text-[28px] leading-none font-[750] tabular-nums",
          tone === "warning" && "text-kick-red",
          tone === "success" && "text-green-text",
          tone === "default" && "text-ink",
        )}
      >
        {formatCount(value)}
      </p>
      <p className="mt-1.5 text-sm text-ink-3">{label}</p>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title}>
      <h2 className="font-display text-xl font-bold text-ink">{title}</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">{children}</div>
    </section>
  );
}

export default async function AdminDataQualityPage() {
  await requireAdmin();
  const q = await getDataQuality();

  return (
    <div className="space-y-8">
      <Group title="Catalogue size">
        <StatTile label="Universities" value={q.totalUniversities} />
        <StatTile label="Programmes" value={q.totalPrograms} />
        <StatTile label="Scholarships" value={q.totalScholarships} />
      </Group>
      <Group title="Verification">
        <StatTile label="Verified programmes" value={q.verifiedPrograms} tone="success" />
        <StatTile label="Unverified programmes" value={q.unverifiedPrograms} tone="warning" />
        <StatTile label="Scholarships pending verification" value={q.scholarshipsPendingVerification} tone="warning" />
      </Group>
      <Group title="Completeness gaps">
        <StatTile label="Programmes missing tuition" value={q.programsMissingTuition} tone="warning" />
        <StatTile label="Programmes missing deadlines" value={q.programsMissingDeadlines} tone="warning" />
        <StatTile label="Programmes missing requirements" value={q.programsMissingRequirements} tone="warning" />
      </Group>
      <Group title="Media coverage">
        <StatTile label="Institutions with a logo" value={q.institutionsWithLogo} tone="success" />
        <StatTile label="Institutions with a cover photo" value={q.institutionsWithCover} tone="success" />
        <StatTile label="Institutions with neither" value={q.institutionsWithNeither} tone="warning" />
      </Group>
      <Group title="Sources">
        <StatTile label="Total sources" value={q.totalSources} />
        <StatTile label="Active" value={q.activeSources} tone="success" />
        <StatTile label="Paused" value={q.pausedSources} tone="warning" />
      </Group>
    </div>
  );
}
