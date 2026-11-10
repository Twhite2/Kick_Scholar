import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { humanise } from "@/lib/ui/text";
import { formatCount } from "@/lib/ui/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Sources" };

const th = "px-4 py-3 text-left text-[13px] font-bold text-ink-3";

export default async function AdminSourcesPage() {
  await requireAdmin();
  const sources = await prisma.source.findMany({
    include: { _count: { select: { crawlJobs: true, documents: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="overflow-x-auto rounded-panel bg-white shadow-hairline">
      <table className="w-full min-w-[760px] text-[15px]">
        <thead className="border-b border-line">
          <tr>
            <th scope="col" className={th}>Source</th>
            <th scope="col" className={th}>Type</th>
            <th scope="col" className={th}>Authority</th>
            <th scope="col" className={th}>Status</th>
            <th scope="col" className={th}>Last crawled</th>
            <th scope="col" className={th}>Documents</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {sources.map((s) => (
            <tr key={s.id} className="align-top">
              <td className="px-4 py-3">
                <p className="font-bold text-ink">{s.name}</p>
                <p className="text-sm text-ink-3">{s.country ?? "Multi-country"}</p>
              </td>
              <td className="px-4 py-3 text-sm text-ink-2">{humanise(s.type)}</td>
              <td className="px-4 py-3">
                <span className={cn("inline-flex h-7 items-center rounded-full px-2.5 type-caption", s.authorityLevel === "PRIMARY" ? "bg-green-tint text-green-text" : "bg-grey-tint text-slate")}>
                  {humanise(s.authorityLevel)}
                </span>
              </td>
              <td className="px-4 py-3">
                <span
                  className={cn(
                    "inline-flex h-7 items-center rounded-full px-2.5 type-caption",
                    s.status === "ACTIVE" ? "bg-green-tint text-green-text" : s.status === "PAUSED" ? "bg-grey-tint text-slate" : "bg-red-tint text-red-text",
                  )}
                >
                  {humanise(s.status)}
                </span>
              </td>
              <td className="px-4 py-3 font-mono text-sm text-ink-3">{s.lastCrawledAt ? s.lastCrawledAt.toLocaleString("en-GB") : "Never"}</td>
              <td className="px-4 py-3 text-sm text-ink tabular-nums">{formatCount(s._count.documents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
