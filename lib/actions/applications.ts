"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { ApplicationStatus } from "@/lib/generated/prisma/enums";
import type { FactorScore } from "@/lib/matching/types";
import { blockersOf } from "@/lib/ui/blockers";
import { deriveNextSteps } from "@/lib/ui/next-steps";

const STATUS_ORDER: ApplicationStatus[] = [
  "SAVED",
  "PLANNING",
  "IN_PROGRESS",
  "SUBMITTED",
  "ACCEPTED",
];

/** Everywhere that shows applications: My plan and Home's "Pick up" cards. */
function revalidateApplications() {
  revalidatePath("/plan");
  revalidatePath("/dashboard");
}

/**
 * The checklist a new application starts with: the same steps the detail
 * page shows under "Your next steps", so ticking one ticks the other.
 */
async function seedChecklist(
  userId: string,
  opportunityType: "PROGRAM" | "SCHOLARSHIP",
  targetId: string,
): Promise<string[]> {
  const now = new Date();
  if (opportunityType === "PROGRAM") {
    const [program, match] = await Promise.all([
      prisma.program.findUnique({
        where: { id: targetId },
        select: {
          requirements: { select: { requirementType: true, testName: true } },
          deadlines: { where: { date: { gte: now } }, orderBy: { date: "asc" }, take: 1, select: { date: true } },
        },
      }),
      prisma.match.findFirst({ where: { userId, programId: targetId }, select: { factorScores: true } }),
    ]);
    if (!program) return [];
    return deriveNextSteps({
      kind: "PROGRAM",
      blockers: blockersOf((match?.factorScores as unknown as FactorScore[]) ?? []),
      requirements: program.requirements.map((r) => ({ type: r.requirementType, testName: r.testName })),
      deadline: program.deadlines[0]?.date ?? null,
      now,
    }).map((s) => s.label);
  }
  const [scholarship, match] = await Promise.all([
    prisma.scholarship.findUnique({
      where: { id: targetId },
      select: {
        eligibility: { select: { criterionType: true, textValue: true } },
        deadlines: { where: { date: { gte: now } }, orderBy: { date: "asc" }, take: 1, select: { date: true } },
      },
    }),
    prisma.match.findFirst({ where: { userId, scholarshipId: targetId }, select: { factorScores: true } }),
  ]);
  if (!scholarship) return [];
  return deriveNextSteps({
    kind: "SCHOLARSHIP",
    blockers: blockersOf((match?.factorScores as unknown as FactorScore[]) ?? []),
    requirements: scholarship.eligibility.map((e) => ({ type: e.criterionType, testName: e.textValue })),
    deadline: scholarship.deadlines[0]?.date ?? null,
    now,
  }).map((s) => s.label);
}

export async function startApplication(
  opportunityType: "PROGRAM" | "SCHOLARSHIP",
  targetId: string,
): Promise<{ id: string } | { error: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Not signed in." };

  const where = opportunityType === "PROGRAM" ? { programId: targetId } : { scholarshipId: targetId };
  const existing = await prisma.application.findFirst({ where: { userId: session.user.id, ...where } });
  if (existing) return { id: existing.id };

  const steps = await seedChecklist(session.user.id, opportunityType, targetId);
  const created = await prisma.application.create({
    data: {
      userId: session.user.id,
      opportunityType,
      ...where,
      status: "SAVED",
      // Steps are already de-duplicated by deriveNextSteps.
      documents: { create: steps.map((name) => ({ name })) },
    },
  });
  revalidateApplications();
  return { id: created.id };
}

export async function moveApplication(applicationId: string, direction: "forward" | "back") {
  const session = await auth();
  if (!session?.user) return { error: "Not signed in." };

  const application = await prisma.application.findFirst({
    where: { id: applicationId, userId: session.user.id },
  });
  if (!application) return { error: "Application not found." };

  // A rejection or withdrawal can be undone: it goes back to where a decision
  // could have come from — Submitted if it was ever submitted, otherwise
  // Planning. The board's buttons then move it on from there.
  if (application.status === "REJECTED" || application.status === "WITHDRAWN") {
    if (direction !== "back") return { error: "Cannot move further in that direction." };
    const restored: ApplicationStatus = application.submittedAt ? "SUBMITTED" : "PLANNING";
    await prisma.application.update({
      where: { id: applicationId },
      data: { status: restored, statusUpdatedAt: new Date(), decisionAt: null },
    });
    revalidateApplications();
    return { success: true };
  }

  const currentIndex = STATUS_ORDER.indexOf(application.status);
  const nextIndex = direction === "forward" ? currentIndex + 1 : currentIndex - 1;
  if (currentIndex === -1 || nextIndex < 0 || nextIndex >= STATUS_ORDER.length) {
    return { error: "Cannot move further in that direction." };
  }

  const next = STATUS_ORDER[nextIndex];
  await prisma.application.update({
    where: { id: applicationId },
    data: {
      status: next,
      statusUpdatedAt: new Date(),
      submittedAt: next === "SUBMITTED" && !application.submittedAt ? new Date() : application.submittedAt,
      // Moving back out of Accepted clears the decision.
      decisionAt: next === "ACCEPTED" ? new Date() : application.status === "ACCEPTED" ? null : application.decisionAt,
    },
  });
  revalidateApplications();
  return { success: true };
}

export async function markRejected(applicationId: string) {
  const session = await auth();
  if (!session?.user) return { error: "Not signed in." };

  await prisma.application.updateMany({
    where: { id: applicationId, userId: session.user.id },
    data: { status: "REJECTED", statusUpdatedAt: new Date(), decisionAt: new Date() },
  });
  revalidateApplications();
  return { success: true };
}

export async function toggleApplicationDocument(documentId: string, completed: boolean) {
  const session = await auth();
  if (!session?.user) return { error: "Not signed in." };

  await prisma.applicationDocument.updateMany({
    where: { id: documentId, application: { userId: session.user.id } },
    data: { completed },
  });
  revalidateApplications();
  return { success: true };
}

export async function addApplicationDocument(applicationId: string, name: string) {
  const session = await auth();
  if (!session?.user) return { error: "Not signed in." };

  const application = await prisma.application.findFirst({
    where: { id: applicationId, userId: session.user.id },
    include: { documents: { select: { name: true } } },
  });
  if (!application) return { error: "Application not found." };
  const trimmed = name.trim();
  if (!trimmed) return { error: "Name the document first." };
  if (application.documents.some((d) => d.name.toLowerCase() === trimmed.toLowerCase())) {
    return { error: "That document is already on the list." };
  }

  await prisma.applicationDocument.create({ data: { applicationId, name: trimmed } });
  revalidateApplications();
  return { success: true };
}
