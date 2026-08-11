"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { crossReferenceCheck } from "@/lib/verification/crossReferenceCheck";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Admin access required");
  }
  return session.user;
}

/** Re-runs the automated cross-reference check (same logic the pipeline uses at load time). */
export async function adminRecheckScholarship(scholarshipId: string) {
  await requireAdmin();
  const result = await crossReferenceCheck(prisma, "SCHOLARSHIP", scholarshipId);
  revalidatePath("/admin/verification");
  return result;
}

/** Manual override: an admin has personally confirmed this record. */
export async function adminMarkVerified(scholarshipId: string) {
  const admin = await requireAdmin();
  await prisma.scholarship.update({
    where: { id: scholarshipId },
    data: {
      verified: true,
      verificationStatus: "VERIFIED",
      lastVerifiedAt: new Date(),
      verifiedBy: `admin:${admin.email}`,
    },
  });
  revalidatePath("/admin/verification");
  return { success: true };
}

export async function adminMarkRejected(scholarshipId: string) {
  const admin = await requireAdmin();
  await prisma.scholarship.update({
    where: { id: scholarshipId },
    data: { verified: false, verificationStatus: "REJECTED", verifiedBy: `admin:${admin.email}` },
  });
  revalidatePath("/admin/verification");
  return { success: true };
}
