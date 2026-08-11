// Hand-authored fixture data — NOT crawled. Unblocks frontend development
// (Phase 5) in parallel with the real ingestion pipeline (Phase 3). Every
// fact still carries genuine provenance fields so the UI can be built
// against the same shape real, sourced data will have.
import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  // --- Sources -------------------------------------------------------
  const daad = await prisma.source.upsert({
    where: { id: "src-daad" },
    update: {},
    create: {
      id: "src-daad",
      name: "DAAD (German Academic Exchange Service)",
      type: "NATIONAL_EDUCATION_PORTAL",
      country: "DE",
      baseUrl: "https://www.daad.de",
      authorityLevel: "PRIMARY",
      crawlFrequency: "MANUAL",
      status: "ACTIVE",
    },
  });

  const studyinfo = await prisma.source.upsert({
    where: { id: "src-studyinfo" },
    update: {},
    create: {
      id: "src-studyinfo",
      name: "Studyinfo.fi",
      type: "NATIONAL_EDUCATION_PORTAL",
      country: "FI",
      baseUrl: "https://www.studyinfo.fi",
      authorityLevel: "PRIMARY",
      crawlFrequency: "MANUAL",
      status: "ACTIVE",
    },
  });

  const tuBerlin = await prisma.source.upsert({
    where: { id: "src-tu-berlin" },
    update: {},
    create: {
      id: "src-tu-berlin",
      name: "TU Berlin — official website",
      type: "UNIVERSITY",
      country: "DE",
      baseUrl: "https://www.tu.berlin",
      authorityLevel: "PRIMARY",
      crawlFrequency: "MANUAL",
      status: "ACTIVE",
    },
  });

  const aaltoSource = await prisma.source.upsert({
    where: { id: "src-aalto" },
    update: {},
    create: {
      id: "src-aalto",
      name: "Aalto University — official website",
      type: "UNIVERSITY",
      country: "FI",
      baseUrl: "https://www.aalto.fi",
      authorityLevel: "PRIMARY",
      crawlFrequency: "MANUAL",
      status: "ACTIVE",
    },
  });

  const brightScholarship = await prisma.source.upsert({
    where: { id: "src-bright-scholarship" },
    update: {},
    create: {
      id: "src-bright-scholarship",
      name: "Bright Scholarship",
      type: "SCHOLARSHIP_AGGREGATOR",
      country: null,
      baseUrl: "https://brightscholarship.com",
      authorityLevel: "DISCOVERY",
      crawlFrequency: "MANUAL",
      status: "ACTIVE",
    },
  });

  // --- Universities ----------------------------------------------------
  const tub = await prisma.university.upsert({
    where: { dedupeKey: "de-technical-university-of-berlin" },
    update: {},
    create: {
      dedupeKey: "de-technical-university-of-berlin",
      name: "Technical University of Berlin",
      country: "DE",
      city: "Berlin",
      type: "PUBLIC",
      website: "https://www.tu.berlin",
      description:
        "A leading German technical university with a strong focus on engineering, computer science, and the natural sciences.",
      primarySourceId: tuBerlin.id,
      sourceUrl: "https://www.tu.berlin/en/",
      authorityLevel: "PRIMARY",
      confidence: 1,
      verified: true,
      verificationStatus: "VERIFIED",
      lastVerifiedAt: new Date("2026-08-01T00:00:00Z"),
      verifiedBy: "system:fixture",
    },
  });

  const aalto = await prisma.university.upsert({
    where: { dedupeKey: "fi-aalto-university" },
    update: {},
    create: {
      dedupeKey: "fi-aalto-university",
      name: "Aalto University",
      country: "FI",
      city: "Espoo",
      type: "PUBLIC",
      website: "https://www.aalto.fi",
      description:
        "A Finnish university formed from the merger of three institutions, known for technology, business, and design.",
      primarySourceId: aaltoSource.id,
      sourceUrl: "https://www.aalto.fi/en",
      authorityLevel: "PRIMARY",
      confidence: 1,
      verified: true,
      verificationStatus: "VERIFIED",
      lastVerifiedAt: new Date("2026-08-01T00:00:00Z"),
      verifiedBy: "system:fixture",
    },
  });

  // --- Programs ----------------------------------------------------------
  const tubCompSci = await prisma.program.upsert({
    where: { dedupeKey: "de-tub-msc-computer-science" },
    update: {},
    create: {
      dedupeKey: "de-tub-msc-computer-science",
      universityId: tub.id,
      name: "M.Sc. Computer Science",
      degreeLevel: "MASTER",
      fieldOfStudy: "Computer Science",
      fieldCategory: "STEM",
      durationMonths: 24,
      instructionLanguages: ["English", "German"],
      tuitionType: "FREE",
      tuitionCurrency: "EUR",
      tuitionPeriod: "PER_SEMESTER",
      intakes: ["Winter", "Summer"],
      programUrl: "https://www.tu.berlin/en/study/degree-programs/computer-science-msc",
      description:
        "Public German universities charge no tuition for this program; students pay only the semester contribution (Semesterbeitrag), which covers administration and a public-transport pass.",
      primarySourceId: tuBerlin.id,
      sourceUrl: "https://www.tu.berlin/en/study/degree-programs/computer-science-msc",
      authorityLevel: "PRIMARY",
      confidence: 1,
      verified: true,
      verificationStatus: "VERIFIED",
      lastVerifiedAt: new Date("2026-08-01T00:00:00Z"),
    },
  });

  const tubMechEng = await prisma.program.upsert({
    where: { dedupeKey: "de-tub-msc-mechanical-engineering" },
    update: {},
    create: {
      dedupeKey: "de-tub-msc-mechanical-engineering",
      universityId: tub.id,
      name: "M.Sc. Mechanical Engineering",
      degreeLevel: "MASTER",
      fieldOfStudy: "Mechanical Engineering",
      fieldCategory: "STEM",
      durationMonths: 24,
      instructionLanguages: ["German"],
      tuitionType: "FREE",
      tuitionCurrency: "EUR",
      tuitionPeriod: "PER_SEMESTER",
      intakes: ["Winter"],
      programUrl: "https://www.tu.berlin/en/study/degree-programs/mechanical-engineering-msc",
      primarySourceId: tuBerlin.id,
      sourceUrl: "https://www.tu.berlin/en/study/degree-programs/mechanical-engineering-msc",
      authorityLevel: "PRIMARY",
      confidence: 1,
      verified: true,
      verificationStatus: "VERIFIED",
      lastVerifiedAt: new Date("2026-08-01T00:00:00Z"),
    },
  });

  const aaltoCcis = await prisma.program.upsert({
    where: { dedupeKey: "fi-aalto-msc-ccis" },
    update: {},
    create: {
      dedupeKey: "fi-aalto-msc-ccis",
      universityId: aalto.id,
      name: "M.Sc. in Computer, Communication and Information Sciences",
      degreeLevel: "MASTER",
      fieldOfStudy: "Computer Science",
      fieldCategory: "STEM",
      durationMonths: 24,
      instructionLanguages: ["English"],
      tuitionType: "PAID",
      tuitionAmount: 15000,
      tuitionCurrency: "EUR",
      tuitionPeriod: "PER_YEAR",
      description:
        "Tuition applies to non-EU/EEA students; students from the EU/EEA are not charged tuition fees.",
      intakes: ["Fall"],
      programUrl: "https://www.aalto.fi/en/study-options/masters-programme-in-computer-communication-and-information-sciences",
      primarySourceId: aaltoSource.id,
      sourceUrl: "https://www.aalto.fi/en/study-options/masters-programme-in-computer-communication-and-information-sciences",
      authorityLevel: "PRIMARY",
      confidence: 1,
      verified: true,
      verificationStatus: "VERIFIED",
      lastVerifiedAt: new Date("2026-08-01T00:00:00Z"),
    },
  });

  // --- Program requirements ----------------------------------------------
  const requirementProvenance = (sourceId: string, sourceUrl: string) => ({
    primarySourceId: sourceId,
    sourceUrl,
    authorityLevel: "PRIMARY" as const,
    confidence: 1,
    verified: true,
    verificationStatus: "VERIFIED" as const,
    lastVerifiedAt: new Date("2026-08-01T00:00:00Z"),
  });

  await prisma.programRequirement.createMany({
    skipDuplicates: true,
    data: [
      {
        id: "req-tub-cs-ielts",
        programId: tubCompSci.id,
        requirementType: "LANGUAGE_TEST",
        testName: "IELTS",
        operator: "GTE",
        value: "6.5",
        description: "Overall IELTS band score of at least 6.5, with no sub-score below 6.0.",
        ...requirementProvenance(tuBerlin.id, tubCompSci.sourceUrl),
      },
      {
        id: "req-tub-cs-gpa",
        programId: tubCompSci.id,
        requirementType: "MIN_GPA",
        // German grading is inverted (1.0 = best, 4.0 = pass), so "2.5 or
        // better" means the applicant's grade must be <= 2.5, not >=.
        operator: "LTE",
        value: "2.5",
        unit: "German scale (1.0 best – 4.0 pass)",
        description: "Bachelor's degree with a final grade of 2.5 or better on the German scale.",
        ...requirementProvenance(tuBerlin.id, tubCompSci.sourceUrl),
      },
      {
        id: "req-tub-cs-degree",
        programId: tubCompSci.id,
        requirementType: "DEGREE_PREREQUISITE",
        operator: "BOOLEAN_TRUE",
        value: "true",
        description: "Bachelor's degree in Computer Science or a closely related field.",
        ...requirementProvenance(tuBerlin.id, tubCompSci.sourceUrl),
      },
      {
        id: "req-aalto-ccis-ielts",
        programId: aaltoCcis.id,
        requirementType: "LANGUAGE_TEST",
        testName: "IELTS",
        operator: "GTE",
        value: "6.5",
        description: "Overall IELTS band score of at least 6.5.",
        ...requirementProvenance(aaltoSource.id, aaltoCcis.sourceUrl),
      },
      {
        id: "req-aalto-ccis-degree",
        programId: aaltoCcis.id,
        requirementType: "DEGREE_PREREQUISITE",
        operator: "BOOLEAN_TRUE",
        value: "true",
        description: "Bachelor's degree in computer science, mathematics, or a related technical field.",
        ...requirementProvenance(aaltoSource.id, aaltoCcis.sourceUrl),
      },
    ],
  });

  // --- Application deadlines ----------------------------------------------
  await prisma.applicationDeadline.createMany({
    skipDuplicates: true,
    data: [
      {
        id: "dl-tub-cs-winter",
        programId: tubCompSci.id,
        deadlineType: "APPLICATION",
        date: new Date("2026-07-15T23:59:00Z"),
        intake: "Winter",
        ...requirementProvenance(tuBerlin.id, tubCompSci.sourceUrl),
      },
      {
        id: "dl-aalto-ccis-fall",
        programId: aaltoCcis.id,
        deadlineType: "APPLICATION",
        date: new Date("2026-01-07T23:59:00Z"),
        intake: "Fall",
        ...requirementProvenance(aaltoSource.id, aaltoCcis.sourceUrl),
      },
    ],
  });

  // --- Scholarships --------------------------------------------------------
  const daadScholarship = await prisma.scholarship.upsert({
    where: { dedupeKey: "de-daad-epos-scholarship" },
    update: {},
    create: {
      dedupeKey: "de-daad-epos-scholarship",
      name: "DAAD EPOS Scholarship",
      providerName: "DAAD",
      providerType: "NATIONAL_EDUCATION_PORTAL",
      country: "DE",
      coverageType: "FULL_FUNDING",
      description:
        "Full funding (tuition, stipend, travel, insurance) for master's students from developing countries in development-related fields.",
      applicationUrl: "https://www.daad.de/en/study-and-research-in-germany/scholarships/",
      isRenewable: true,
      primarySourceId: daad.id,
      sourceUrl: "https://www.daad.de/en/study-and-research-in-germany/scholarships/",
      authorityLevel: "PRIMARY",
      confidence: 1,
      verified: true,
      verificationStatus: "VERIFIED",
      lastVerifiedAt: new Date("2026-08-01T00:00:00Z"),
    },
  });

  const aaltoScholarship = await prisma.scholarship.upsert({
    where: { dedupeKey: "fi-aalto-university-scholarship" },
    update: {},
    create: {
      dedupeKey: "fi-aalto-university-scholarship",
      name: "Aalto University Scholarship",
      providerName: "Aalto University",
      providerType: "UNIVERSITY",
      country: "FI",
      coverageType: "PARTIAL_TUITION",
      description:
        "Merit-based tuition scholarships of 30-100% for admitted non-EU/EEA master's students.",
      applicationUrl: "https://www.aalto.fi/en/study-options/aalto-university-scholarships",
      isRenewable: true,
      primarySourceId: aaltoSource.id,
      sourceUrl: "https://www.aalto.fi/en/study-options/aalto-university-scholarships",
      authorityLevel: "PRIMARY",
      confidence: 1,
      verified: true,
      verificationStatus: "VERIFIED",
      lastVerifiedAt: new Date("2026-08-01T00:00:00Z"),
    },
  });

  // Discovered via Bright Scholarship — DISCOVERY authority, not yet
  // cross-referenced against an official source, so verified stays false
  // and it is NOT linked to any specific university/program via
  // FundingOpportunity. It can still surface as a potential match through
  // the recommendation engine (Phase 4) based on its eligibility criteria
  // alone — this is the "external scholarship that may fund your program"
  // case the product is built around.
  const externalScholarship = await prisma.scholarship.upsert({
    where: { dedupeKey: "global-excellence-stem-scholarship" },
    update: {},
    create: {
      dedupeKey: "global-excellence-stem-scholarship",
      name: "Global Excellence STEM Scholarship",
      providerName: "Global Excellence Foundation",
      providerType: "SCHOLARSHIP_PROVIDER",
      country: null,
      amount: 5000,
      amountCurrency: "EUR",
      coverageType: "STIPEND",
      description:
        "A one-time stipend for outstanding international master's students in STEM fields, discovered via a scholarship aggregator and not yet verified against an official source.",
      applicationUrl: "https://brightscholarship.com/global-excellence-stem-scholarship",
      discoveredFrom: brightScholarship.id,
      discoveryUrl: "https://brightscholarship.com/global-excellence-stem-scholarship",
      primarySourceId: brightScholarship.id,
      sourceUrl: "https://brightscholarship.com/global-excellence-stem-scholarship",
      authorityLevel: "DISCOVERY",
      confidence: 0.5,
      verified: false,
      verificationStatus: "UNVERIFIED",
    },
  });

  // --- Scholarship eligibility ---------------------------------------------
  const eligibilityProvenance = (
    sourceId: string,
    sourceUrl: string,
    authorityLevel: "PRIMARY" | "DISCOVERY",
  ) => ({
    primarySourceId: sourceId,
    sourceUrl,
    authorityLevel,
    confidence: authorityLevel === "PRIMARY" ? 1 : 0.5,
    verified: authorityLevel === "PRIMARY",
    verificationStatus:
      authorityLevel === "PRIMARY"
        ? ("VERIFIED" as const)
        : ("UNVERIFIED" as const),
    lastVerifiedAt: authorityLevel === "PRIMARY" ? new Date("2026-08-01T00:00:00Z") : null,
  });

  await prisma.scholarshipEligibility.createMany({
    skipDuplicates: true,
    data: [
      {
        id: "elig-daad-degree",
        scholarshipId: daadScholarship.id,
        criterionType: "DEGREE_LEVEL",
        operator: "IN_LIST",
        valueList: ["MASTER"],
        description: "Open to applicants pursuing a Master's degree.",
        ...eligibilityProvenance(daad.id, daadScholarship.sourceUrl, "PRIMARY"),
      },
      {
        id: "elig-daad-field",
        scholarshipId: daadScholarship.id,
        criterionType: "FIELD_OF_STUDY",
        operator: "IN_LIST",
        valueList: ["Development-related fields", "Engineering", "Economics"],
        description: "Priority given to development-related, engineering, and economics fields.",
        ...eligibilityProvenance(daad.id, daadScholarship.sourceUrl, "PRIMARY"),
      },
      {
        id: "elig-aalto-degree",
        scholarshipId: aaltoScholarship.id,
        criterionType: "DEGREE_LEVEL",
        operator: "IN_LIST",
        valueList: ["MASTER"],
        description: "Automatically considered for all admitted non-EU/EEA master's applicants.",
        ...eligibilityProvenance(aaltoSource.id, aaltoScholarship.sourceUrl, "PRIMARY"),
      },
      {
        id: "elig-aalto-university",
        scholarshipId: aaltoScholarship.id,
        criterionType: "UNIVERSITY",
        operator: "IN_LIST",
        valueList: [aalto.id],
        description: "Only available to students admitted to Aalto University programs.",
        ...eligibilityProvenance(aaltoSource.id, aaltoScholarship.sourceUrl, "PRIMARY"),
      },
      {
        id: "elig-external-degree",
        scholarshipId: externalScholarship.id,
        criterionType: "DEGREE_LEVEL",
        operator: "IN_LIST",
        valueList: ["MASTER"],
        description: "Listed as open to Master's-level students.",
        ...eligibilityProvenance(brightScholarship.id, externalScholarship.sourceUrl, "DISCOVERY"),
      },
      {
        id: "elig-external-field",
        scholarshipId: externalScholarship.id,
        criterionType: "FIELD_OF_STUDY",
        operator: "IN_LIST",
        valueList: ["STEM"],
        description: "Listed as open to STEM fields.",
        ...eligibilityProvenance(brightScholarship.id, externalScholarship.sourceUrl, "DISCOVERY"),
      },
      {
        id: "elig-external-gpa",
        scholarshipId: externalScholarship.id,
        criterionType: "MIN_GPA",
        operator: "GTE",
        numericValue: 3.5,
        textValue: "on a 4.0 scale",
        description: "Listed as requiring a strong academic record (3.5/4.0 GPA or equivalent).",
        ...eligibilityProvenance(brightScholarship.id, externalScholarship.sourceUrl, "DISCOVERY"),
      },
    ],
  });

  // --- Funding opportunities (explicit, sourced links) ----------------------
  await prisma.fundingOpportunity.createMany({
    skipDuplicates: true,
    data: [
      {
        id: "fund-daad-tub-cs",
        scholarshipId: daadScholarship.id,
        universityId: tub.id,
        programId: tubCompSci.id,
        fundingType: "GOVERNMENT_SPONSORED",
        coverageType: "FULL_FUNDING",
        ...requirementProvenance(daad.id, daadScholarship.sourceUrl),
      },
      {
        id: "fund-daad-tub-mech",
        scholarshipId: daadScholarship.id,
        universityId: tub.id,
        programId: tubMechEng.id,
        fundingType: "GOVERNMENT_SPONSORED",
        coverageType: "FULL_FUNDING",
        ...requirementProvenance(daad.id, daadScholarship.sourceUrl),
      },
      {
        id: "fund-aalto-ccis",
        scholarshipId: aaltoScholarship.id,
        universityId: aalto.id,
        programId: aaltoCcis.id,
        fundingType: "OFFICIAL_UNIVERSITY_SCHOLARSHIP",
        coverageType: "PARTIAL_TUITION",
        ...requirementProvenance(aaltoSource.id, aaltoScholarship.sourceUrl),
      },
    ],
  });

  console.log("Seed complete:");
  console.log(`  Sources: ${await prisma.source.count()}`);
  console.log(`  Universities: ${await prisma.university.count()}`);
  console.log(`  Programs: ${await prisma.program.count()}`);
  console.log(`  Scholarships: ${await prisma.scholarship.count()}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
