import { cache } from "react";
import { prisma } from "@/lib/db";
import { applicantGroupFor, type ApplicantGroup } from "./applicant-group";

/** The signed-in student's EU / non-EU group, from their profile's nationality. */
export const getApplicantGroup = cache(async (userId: string | null | undefined): Promise<ApplicantGroup | null> => {
  if (!userId) return null;
  const profile = await prisma.studentProfile.findUnique({ where: { userId }, select: { nationality: true } });
  return applicantGroupFor(profile?.nationality);
});
