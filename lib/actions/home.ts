"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * Records that the student has seen Home. Called from a client effect after
 * the page has rendered, so the "new since" counts on screen were computed
 * from the previous visit and a refresh doesn't zero them before they're seen
 * (docs/ui-remodel.md §10.3). Deliberately does not revalidate.
 */
export async function markHomeVisited(): Promise<void> {
  const session = await auth();
  if (!session?.user) return;
  await prisma.user.update({
    where: { id: session.user.id },
    data: { homeLastVisitedAt: new Date() },
  });
}
