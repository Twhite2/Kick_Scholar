"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** Saved state shows on catalogues, Home rails and My plan. */
function revalidateSaved(catalogue: "/programs" | "/scholarships") {
  revalidatePath(catalogue);
  revalidatePath("/plan");
  revalidatePath("/dashboard");
}

export async function toggleSavedProgram(programId: string) {
  const session = await auth();
  if (!session?.user) return { error: "Not signed in." };

  const existing = await prisma.savedOpportunity.findFirst({
    where: { userId: session.user.id, programId },
  });
  if (existing) {
    await prisma.savedOpportunity.delete({ where: { id: existing.id } });
    revalidateSaved("/programs");
    return { saved: false };
  }
  await prisma.savedOpportunity.create({
    data: { userId: session.user.id, opportunityType: "PROGRAM", programId },
  });
  revalidateSaved("/programs");
  return { saved: true };
}

export async function toggleSavedScholarship(scholarshipId: string) {
  const session = await auth();
  if (!session?.user) return { error: "Not signed in." };

  const existing = await prisma.savedOpportunity.findFirst({
    where: { userId: session.user.id, scholarshipId },
  });
  if (existing) {
    await prisma.savedOpportunity.delete({ where: { id: existing.id } });
    revalidateSaved("/scholarships");
    return { saved: false };
  }
  await prisma.savedOpportunity.create({
    data: { userId: session.user.id, opportunityType: "SCHOLARSHIP", scholarshipId },
  });
  revalidateSaved("/scholarships");
  return { saved: true };
}
