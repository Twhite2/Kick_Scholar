import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Mono } from "@/components/ui/mono";

export default async function AdminCrawlJobsPage() {
  const jobs = await prisma.crawlJob.findMany({
    include: { source: true },
    orderBy: { startedAt: "desc" },
    take: 50,
  });

  return (
    <div className="overflow-x-auto rounded-2xl border border-border">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-surface text-left text-xs text-muted-foreground uppercase">
          <tr>
            <th className="px-4 py-3 font-medium">Source</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Started</th>
            <th className="px-4 py-3 font-medium">Pages Crawled</th>
            <th className="px-4 py-3 font-medium">Failed</th>
            <th className="px-4 py-3 font-medium">New Docs</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {jobs.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                No crawl jobs yet.
              </td>
            </tr>
          )}
          {jobs.map((j) => (
            <tr key={j.id}>
              <td className="px-4 py-3 font-medium">{j.source.name}</td>
              <td className="px-4 py-3">
                <Badge
                  className={
                    j.status === "SUCCESS"
                      ? "bg-success/10 text-success"
                      : j.status === "FAILED"
                        ? "bg-destructive/10 text-destructive"
                        : j.status === "PARTIAL"
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                  }
                >
                  {j.status}
                </Badge>
              </td>
              <td className="px-4 py-3">
                <Mono className="text-xs text-muted-foreground">{j.startedAt.toLocaleString()}</Mono>
              </td>
              <td className="px-4 py-3"><Mono className="text-xs">{j.pagesCrawled}</Mono></td>
              <td className="px-4 py-3"><Mono className="text-xs">{j.pagesFailed}</Mono></td>
              <td className="px-4 py-3"><Mono className="text-xs">{j.newDocuments}</Mono></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
