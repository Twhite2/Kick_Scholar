import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { humanise } from "@/lib/ui/text";
import { formatCount } from "@/lib/ui/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Crawl jobs" };

const th = "px-4 py-3 text-left text-[13px] font-bold text-ink-3";

export default async function AdminCrawlJobsPage() {
  await requireAdmin();
  const jobs = await prisma.crawlJob.findMany({
    include: { source: true },
    orderBy: { startedAt: "desc" },
    take: 50,
  });

  return (
    <div className="overflow-x-auto rounded-panel bg-white shadow-hairline">
      <table className="w-full min-w-[720px] text-[15px]">
        <thead className="border-b border-line">
          <tr>
            <th scope="col" className={th}>Source</th>
            <th scope="col" className={th}>Status</th>
            <th scope="col" className={th}>Started</th>
            <th scope="col" className={th}>Pages crawled</th>
            <th scope="col" className={th}>Failed</th>
            <th scope="col" className={th}>New documents</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {jobs.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-10 text-center text-ink-3">
                No crawl jobs yet.
              </td>
            </tr>
          )}
          {jobs.map((j) => (
            <tr key={j.id}>
              <td className="px-4 py-3 font-bold text-ink">{j.source.name}</td>
              <td className="px-4 py-3">
                <span
                  className={cn(
                    "inline-flex h-7 items-center rounded-full px-2.5 type-caption",
                    j.status === "SUCCESS"
                      ? "bg-green-tint text-green-text"
                      : j.status === "FAILED"
                        ? "bg-red-tint text-red-text"
                        : j.status === "PARTIAL"
                          ? "bg-blue-tint text-kick-blue"
                          : "bg-grey-tint text-slate",
                  )}
                >
                  {humanise(j.status)}
                </span>
              </td>
              <td className="px-4 py-3 font-mono text-sm text-ink-3">{j.startedAt.toLocaleString("en-GB")}</td>
              <td className="px-4 py-3 text-sm tabular-nums">{formatCount(j.pagesCrawled)}</td>
              <td className="px-4 py-3 text-sm tabular-nums">{formatCount(j.pagesFailed)}</td>
              <td className="px-4 py-3 text-sm tabular-nums">{formatCount(j.newDocuments)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
