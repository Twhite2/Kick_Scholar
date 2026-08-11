import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Mono } from "@/components/ui/mono";

export default async function AdminSourcesPage() {
  const sources = await prisma.source.findMany({
    include: { _count: { select: { crawlJobs: true, documents: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div className="overflow-x-auto rounded-2xl border border-border">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-surface text-left text-xs text-muted-foreground uppercase">
          <tr>
            <th className="px-4 py-3 font-medium">Source</th>
            <th className="px-4 py-3 font-medium">Type</th>
            <th className="px-4 py-3 font-medium">Authority</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Last Crawled</th>
            <th className="px-4 py-3 font-medium">Documents</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sources.map((s) => (
            <tr key={s.id}>
              <td className="px-4 py-3">
                <p className="font-medium">{s.name}</p>
                <p className="text-xs text-muted-foreground">{s.country ?? "Multi-country"}</p>
              </td>
              <td className="px-4 py-3 text-xs text-muted-foreground">{s.type.replace(/_/g, " ")}</td>
              <td className="px-4 py-3">
                <Badge
                  variant={s.authorityLevel === "PRIMARY" ? "secondary" : "outline"}
                >
                  {s.authorityLevel}
                </Badge>
              </td>
              <td className="px-4 py-3">
                <Badge
                  className={
                    s.status === "ACTIVE"
                      ? "bg-success/10 text-success"
                      : s.status === "PAUSED"
                        ? "bg-muted text-muted-foreground"
                        : "bg-destructive/10 text-destructive"
                  }
                >
                  {s.status}
                </Badge>
              </td>
              <td className="px-4 py-3">
                <Mono className="text-xs text-muted-foreground">
                  {s.lastCrawledAt ? s.lastCrawledAt.toLocaleString() : "Never"}
                </Mono>
              </td>
              <td className="px-4 py-3">
                <Mono className="text-xs">{s._count.documents}</Mono>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
