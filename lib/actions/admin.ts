"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdminAction as requireAdmin } from "@/lib/admin/require-admin-action";
import { crossReferenceCheck } from "@/lib/verification/crossReferenceCheck";

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
