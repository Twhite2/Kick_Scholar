"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function toggleSavedProgram(programId: string) {
  const session = await auth();
  if (!session?.user) return { error: "Not signed in." };

  const existing = await prisma.savedOpportunity.findFirst({
    where: { userId: session.user.id, programId },
  });
  if (existing) {
    await prisma.savedOpportunity.delete({ where: { id: existing.id } });
    revalidatePath("/programs");
    revalidatePath("/saved");
    return { saved: false };
  }
  await prisma.savedOpportunity.create({
    data: { userId: session.user.id, opportunityType: "PROGRAM", programId },
  });
  revalidatePath("/programs");
  revalidatePath("/saved");
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
    revalidatePath("/scholarships");
    revalidatePath("/saved");
    return { saved: false };
  }
  await prisma.savedOpportunity.create({
    data: { userId: session.user.id, opportunityType: "SCHOLARSHIP", scholarshipId },
  });
  revalidatePath("/scholarships");
  revalidatePath("/saved");
  return { saved: true };
}
