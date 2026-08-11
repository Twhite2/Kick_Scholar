import { prisma } from "@/lib/db";

export interface DataQualityReport {
  totalUniversities: number;
  totalPrograms: number;
  totalScholarships: number;
  verifiedPrograms: number;
  unverifiedPrograms: number;
  programsMissingTuition: number;
  programsMissingDeadlines: number;
  programsMissingRequirements: number;
  scholarshipsPendingVerification: number;
  totalSources: number;
  activeSources: number;
  pausedSources: number;
}

export async function getDataQuality(): Promise<DataQualityReport> {
  const [
    totalUniversities,
    totalPrograms,
    totalScholarships,
    verifiedPrograms,
    programsMissingTuition,
    programsWithDeadlines,
    programsWithRequirements,
    scholarshipsPendingVerification,
    totalSources,
    activeSources,
    pausedSources,
  ] = await Promise.all([
    prisma.university.count(),
    prisma.program.count(),
    prisma.scholarship.count(),
    prisma.program.count({ where: { verificationStatus: "VERIFIED" } }),
    prisma.program.count({ where: { tuitionType: "UNKNOWN" } }),
    prisma.program.findMany({ where: { deadlines: { some: {} } }, select: { id: true } }),
    prisma.program.findMany({ where: { requirements: { some: {} } }, select: { id: true } }),
    prisma.scholarship.count({ where: { verificationStatus: { in: ["UNVERIFIED", "PENDING_VERIFICATION"] } } }),
    prisma.source.count(),
    prisma.source.count({ where: { status: "ACTIVE" } }),
    prisma.source.count({ where: { status: "PAUSED" } }),
  ]);

  return {
    totalUniversities,
    totalPrograms,
    totalScholarships,
    verifiedPrograms,
    unverifiedPrograms: totalPrograms - verifiedPrograms,
    programsMissingTuition,
    programsMissingDeadlines: totalPrograms - programsWithDeadlines.length,
    programsMissingRequirements: totalPrograms - programsWithRequirements.length,
    scholarshipsPendingVerification,
    totalSources,
    activeSources,
    pausedSources,
  };
}
