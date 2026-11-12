import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { VerificationQueueRow } from "@/components/admin/verification-queue-row";
import { plural } from "@/lib/ui/format";

export const metadata: Metadata = { title: "Verification queue" };

const th = "px-4 py-3 text-left text-[13px] font-bold text-ink-3";

type Row = Awaited<ReturnType<typeof prisma.scholarship.findMany>>[number];

function QueueTable({ rows }: { rows: Row[] }) {
  return (
    <div className="overflow-x-auto rounded-panel bg-white shadow-hairline">
      <table className="w-full min-w-[880px] text-[15px]">
        <thead className="border-b border-line">
          <tr>
            <th scope="col" className={th}>Scholarship</th>
            <th scope="col" className={th}>Authority</th>
            <th scope="col" className={th}>Status</th>
            <th scope="col" className={th}>Official source</th>
            <th scope="col" className={th}>Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((s) => (
            <VerificationQueueRow
              key={s.id}
              scholarship={{
                id: s.id,
                name: s.name,
                providerName: s.providerName,
                authorityLevel: s.authorityLevel,
                verificationStatus: s.verificationStatus,
                discoveryUrl: s.discoveryUrl,
                officialSourceUrl: s.officialSourceUrl,
              }}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function AdminVerificationPage() {
  await requireAdmin();
  const [scholarships, removed] = await Promise.all([
    prisma.scholarship.findMany({
      where: { verificationStatus: { in: ["UNVERIFIED", "PENDING_VERIFICATION", "CONFLICTING"] } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.scholarship.findMany({
      where: { verificationStatus: "REJECTED" },
      orderBy: [{ primarySourceId: "asc" }, { name: "asc" }],
    }),
  ]);

  return (
    <div className="space-y-10">
      <section>
        <p className="mb-4 max-w-[80ch] text-[15px] text-ink-2">
          {plural(scholarships.length, "scholarship")} awaiting verification. &ldquo;Re-check&rdquo; re-runs the same
          cross-reference logic the ingestion pipeline uses; &ldquo;Verify&rdquo; and &ldquo;Reject&rdquo; are manual admin
          overrides. A rejected scholarship leaves the catalogue, matching and links.
        </p>
        {scholarships.length === 0 ? (
          <div className="rounded-panel border border-dashed border-line-strong bg-white p-12 text-center text-ink-3">
            Nothing pending — every scholarship is verified or rejected.
          </div>
        ) : (
          <QueueTable rows={scholarships} />
        )}
      </section>

      {removed.length > 0 && (
        <section aria-labelledby="removed-heading">
          <h2 id="removed-heading" className="type-section-h2 text-ink">
            Removed from the catalogue <span className="font-normal text-ink-3 tabular-nums">· {removed.length}</span>
          </h2>
          <p className="mt-1 mb-4 max-w-[80ch] text-[15px] text-ink-2">
            Rejected by an admin, or found by the record cleanup to be a website page rather than an award. &ldquo;Verify&rdquo;
            lists one again; re-run linking and matching afterwards.
          </p>
          <QueueTable rows={removed} />
        </section>
      )}
    </div>
  );
}
