"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { ApplicationStatus } from "@/lib/generated/prisma/enums";

const STATUS_ORDER: ApplicationStatus[] = [
  "SAVED",
  "PLANNING",
  "IN_PROGRESS",
  "SUBMITTED",
  "ACCEPTED",
];

export async function startApplication(
  opportunityType: "PROGRAM" | "SCHOLARSHIP",
  targetId: string,
) {
  const session = await auth();
  if (!session?.user) return { error: "Not signed in." };

  const where = opportunityType === "PROGRAM" ? { programId: targetId } : { scholarshipId: targetId };
  const existing = await prisma.application.findFirst({ where: { userId: session.user.id, ...where } });
  if (existing) return { id: existing.id };

  const created = await prisma.application.create({
    data: {
      userId: session.user.id,
      opportunityType,
      ...where,
      status: "SAVED",
    },
  });
  revalidatePath("/applications");
  return { id: created.id };
}

export async function moveApplication(applicationId: string, direction: "forward" | "back") {
  const session = await auth();
  if (!session?.user) return { error: "Not signed in." };

  const application = await prisma.application.findFirst({
    where: { id: applicationId, userId: session.user.id },
  });
  if (!application) return { error: "Application not found." };

  const currentIndex = STATUS_ORDER.indexOf(application.status);
  const nextIndex = direction === "forward" ? currentIndex + 1 : currentIndex - 1;
  if (currentIndex === -1 || nextIndex < 0 || nextIndex >= STATUS_ORDER.length) {
    return { error: "Cannot move further in that direction." };
  }

  await prisma.application.update({
    where: { id: applicationId },
    data: {
      status: STATUS_ORDER[nextIndex],
      statusUpdatedAt: new Date(),
      submittedAt: STATUS_ORDER[nextIndex] === "SUBMITTED" ? new Date() : application.submittedAt,
      decisionAt: STATUS_ORDER[nextIndex] === "ACCEPTED" ? new Date() : application.decisionAt,
    },
  });
  revalidatePath("/applications");
  return { success: true };
}

export async function markRejected(applicationId: string) {
  const session = await auth();
  if (!session?.user) return { error: "Not signed in." };

  await prisma.application.updateMany({
    where: { id: applicationId, userId: session.user.id },
    data: { status: "REJECTED", statusUpdatedAt: new Date(), decisionAt: new Date() },
  });
  revalidatePath("/applications");
  return { success: true };
}

export async function toggleApplicationDocument(documentId: string, completed: boolean) {
  const session = await auth();
  if (!session?.user) return { error: "Not signed in." };

  await prisma.applicationDocument.updateMany({
    where: { id: documentId, application: { userId: session.user.id } },
    data: { completed },
  });
  revalidatePath("/applications");
  return { success: true };
}

export async function addApplicationDocument(applicationId: string, name: string) {
  const session = await auth();
  if (!session?.user) return { error: "Not signed in." };

  const application = await prisma.application.findFirst({
    where: { id: applicationId, userId: session.user.id },
  });
  if (!application) return { error: "Application not found." };

  await prisma.applicationDocument.create({ data: { applicationId, name } });
  revalidatePath("/applications");
  return { success: true };
}
