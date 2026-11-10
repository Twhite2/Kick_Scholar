import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { VerificationQueueRow } from "@/components/admin/verification-queue-row";
import { plural } from "@/lib/ui/format";

export const metadata: Metadata = { title: "Verification queue" };

const th = "px-4 py-3 text-left text-[13px] font-bold text-ink-3";

export default async function AdminVerificationPage() {
  await requireAdmin();
  const scholarships = await prisma.scholarship.findMany({
    where: { verificationStatus: { in: ["UNVERIFIED", "PENDING_VERIFICATION", "CONFLICTING"] } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <p className="mb-4 max-w-[80ch] text-[15px] text-ink-2">
        {plural(scholarships.length, "scholarship")} awaiting verification. &ldquo;Re-check&rdquo; re-runs the same
        cross-reference logic the ingestion pipeline uses; &ldquo;Verify&rdquo; and &ldquo;Reject&rdquo; are manual admin
        overrides.
      </p>
      {scholarships.length === 0 ? (
        <div className="rounded-panel border border-dashed border-line-strong bg-white p-12 text-center text-ink-3">
          Nothing pending — every scholarship is verified or rejected.
        </div>
      ) : (
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
