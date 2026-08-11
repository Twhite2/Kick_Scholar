import { prisma } from "@/lib/db";
import { VerificationQueueRow } from "@/components/admin/verification-queue-row";

export default async function AdminVerificationPage() {
  const scholarships = await prisma.scholarship.findMany({
    where: { verificationStatus: { in: ["UNVERIFIED", "PENDING_VERIFICATION", "CONFLICTING"] } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        {scholarships.length} scholarship{scholarships.length === 1 ? "" : "s"} awaiting verification.
        &quot;Re-check&quot; re-runs the same cross-reference logic the ingestion pipeline uses; &quot;Verify&quot;/&quot;Reject&quot;
        are manual admin overrides.
      </p>
      {scholarships.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
          Nothing pending — every scholarship is verified or rejected.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface text-left text-xs text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">Scholarship</th>
                <th className="px-4 py-3 font-medium">Authority</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Official Source</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {scholarships.map((s) => (
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
      )}
    </div>
  );
}
