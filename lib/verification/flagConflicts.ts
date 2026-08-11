import type { PrismaClient } from "../generated/prisma/client";

/**
 * When two PRIMARY+ sources state different values for the same fact, the
 * record is marked CONFLICTING (never silently picking one) so it surfaces
 * in the admin verification queue for manual resolution. This is a light
 * helper — the actual comparison is provided by the caller, since "does
 * this scalar differ" means different things for a tuition amount vs a
 * date vs a text field.
 */
export async function flagConflict(
  prisma: PrismaClient,
  sourceableType: "SCHOLARSHIP" | "UNIVERSITY" | "PROGRAM",
  sourceableId: string,
  details: { field: string; existingValue: unknown; conflictingValue: unknown; conflictingSourceUrl: string },
): Promise<void> {
  const data = {
    verificationStatus: "CONFLICTING" as const,
    verified: false,
  };

  if (sourceableType === "SCHOLARSHIP") {
    await prisma.scholarship.update({ where: { id: sourceableId }, data });
  } else if (sourceableType === "UNIVERSITY") {
    await prisma.university.update({ where: { id: sourceableId }, data });
  } else {
    await prisma.program.update({ where: { id: sourceableId }, data });
  }

  console.warn(
    `[verification] CONFLICT on ${sourceableType} ${sourceableId}.${details.field}: ` +
      `existing=${JSON.stringify(details.existingValue)} vs conflicting=${JSON.stringify(details.conflictingValue)} ` +
      `(from ${details.conflictingSourceUrl})`,
  );
}
