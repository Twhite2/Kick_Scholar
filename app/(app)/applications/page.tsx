import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { KanbanBoard } from "@/components/applications/kanban-board";
import type { ApplicationCardData } from "@/components/applications/application-card";

export default async function ApplicationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const applications = await prisma.application.findMany({
    where: { userId: session.user.id },
    include: { program: true, scholarship: true, documents: true },
    orderBy: { createdAt: "desc" },
  });

  const cards: ApplicationCardData[] = applications.map((a) => ({
    id: a.id,
    name: a.program?.name ?? a.scholarship?.name ?? "",
    href: a.opportunityType === "PROGRAM" ? `/programs/${a.programId}` : `/scholarships/${a.scholarshipId}`,
    status: a.status,
    documents: a.documents.map((d) => ({ id: d.id, name: d.name, completed: d.completed, required: d.required })),
  }));

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 md:px-8 md:py-12">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Applications</h1>
        <p className="mt-1 text-muted-foreground">Track every application from saved to decided.</p>
      </div>

      {cards.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
          No applications yet — save an opportunity and tap &quot;Track application&quot; to start.
        </div>
      ) : (
        <KanbanBoard applications={cards} />
      )}
    </div>
  );
}
