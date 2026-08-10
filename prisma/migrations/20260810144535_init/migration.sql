-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('UNIVERSITY', 'NATIONAL_EDUCATION_PORTAL', 'GOVERNMENT', 'SCHOLARSHIP_PROVIDER', 'SCHOLARSHIP_AGGREGATOR', 'EDUCATION_DATABASE');

-- CreateEnum
CREATE TYPE "AuthorityLevel" AS ENUM ('PRIMARY', 'SECONDARY', 'DISCOVERY');

-- CreateEnum
CREATE TYPE "CrawlFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'MANUAL');

-- CreateEnum
CREATE TYPE "SourceStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ERROR', 'DEPRECATED');

-- CreateEnum
CREATE TYPE "CrawlJobStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "CrawlJobTrigger" AS ENUM ('MANUAL', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "DocumentContentType" AS ENUM ('HTML', 'MARKDOWN', 'PDF', 'JSON');

-- CreateEnum
CREATE TYPE "ExtractionStatus" AS ENUM ('PENDING', 'EXTRACTED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING_VERIFICATION', 'VERIFIED', 'CONFLICTING', 'REJECTED');

-- CreateEnum
CREATE TYPE "SourceableType" AS ENUM ('UNIVERSITY', 'PROGRAM', 'SCHOLARSHIP', 'PROGRAM_REQUIREMENT', 'SCHOLARSHIP_ELIGIBILITY', 'APPLICATION_DEADLINE', 'FUNDING_OPPORTUNITY');

-- CreateEnum
CREATE TYPE "CitationRole" AS ENUM ('PRIMARY_MATCH', 'CORROBORATING', 'CONFLICTING');

-- CreateEnum
CREATE TYPE "DegreeLevel" AS ENUM ('HIGH_SCHOOL', 'BACHELOR', 'MASTER', 'PHD', 'DIPLOMA', 'CERTIFICATE', 'OTHER');

-- CreateEnum
CREATE TYPE "FieldCategory" AS ENUM ('STEM', 'BUSINESS', 'HUMANITIES', 'SOCIAL_SCIENCES', 'ARTS', 'HEALTH', 'LAW', 'EDUCATION', 'OTHER');

-- CreateEnum
CREATE TYPE "UniversityType" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "TuitionType" AS ENUM ('FREE', 'PAID', 'UNKNOWN', 'VARIES');

-- CreateEnum
CREATE TYPE "TuitionPeriod" AS ENUM ('PER_SEMESTER', 'PER_YEAR', 'PER_PROGRAM', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "RequirementType" AS ENUM ('LANGUAGE_TEST', 'MIN_GPA', 'DEGREE_PREREQUISITE', 'WORK_EXPERIENCE', 'STANDARDIZED_TEST', 'PORTFOLIO', 'INTERVIEW', 'OTHER');

-- CreateEnum
CREATE TYPE "RequirementOperator" AS ENUM ('GTE', 'LTE', 'GT', 'LT', 'EQ', 'IN_LIST', 'BOOLEAN_TRUE');

-- CreateEnum
CREATE TYPE "DeadlineType" AS ENUM ('APPLICATION', 'DOCUMENT_SUBMISSION', 'SCHOLARSHIP_APPLICATION', 'DECISION_NOTIFICATION', 'ENROLLMENT');

-- CreateEnum
CREATE TYPE "ScholarshipCoverageType" AS ENUM ('FULL_TUITION', 'PARTIAL_TUITION', 'STIPEND', 'TRAVEL', 'FULL_FUNDING', 'UNKNOWN', 'VARIES');

-- CreateEnum
CREATE TYPE "FundingType" AS ENUM ('OFFICIAL_UNIVERSITY_SCHOLARSHIP', 'PARTNER_FUNDING', 'GOVERNMENT_SPONSORED', 'EXTERNAL_APPLICABLE');

-- CreateEnum
CREATE TYPE "EligibilityCriterionType" AS ENUM ('NATIONALITY', 'DEGREE_LEVEL', 'FIELD_OF_STUDY', 'MIN_GPA', 'MAX_AGE', 'COUNTRY_OF_STUDY', 'UNIVERSITY', 'FINANCIAL_NEED', 'ACADEMIC_EXCELLENCE', 'WORK_EXPERIENCE', 'LANGUAGE', 'OTHER');

-- CreateEnum
CREATE TYPE "MatchType" AS ENUM ('PROGRAM', 'SCHOLARSHIP');

-- CreateEnum
CREATE TYPE "MatchStrength" AS ENUM ('STRONG_MATCH', 'LIKELY_ELIGIBLE', 'POTENTIAL_MATCH', 'MISSING_REQUIREMENT', 'NEEDS_VERIFICATION');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('SAVED', 'PLANNING', 'IN_PROGRESS', 'SUBMITTED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "SourceType" NOT NULL,
    "country" TEXT,
    "baseUrl" TEXT NOT NULL,
    "authorityLevel" "AuthorityLevel" NOT NULL,
    "crawlFrequency" "CrawlFrequency" NOT NULL DEFAULT 'MANUAL',
    "status" "SourceStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastCrawledAt" TIMESTAMP(3),
    "lastSuccessfulCrawlAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceDocument" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "crawlJobId" TEXT,
    "url" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "httpStatus" INTEGER NOT NULL,
    "contentType" "DocumentContentType" NOT NULL,
    "rawHtmlPath" TEXT,
    "markdownPath" TEXT,
    "rawMetadata" JSONB,
    "checksum" TEXT NOT NULL,
    "extractionStatus" "ExtractionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrawlJob" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" "CrawlJobStatus" NOT NULL DEFAULT 'RUNNING',
    "pagesDiscovered" INTEGER NOT NULL DEFAULT 0,
    "pagesCrawled" INTEGER NOT NULL DEFAULT 0,
    "pagesFailed" INTEGER NOT NULL DEFAULT 0,
    "newDocuments" INTEGER NOT NULL DEFAULT 0,
    "errorLog" TEXT,
    "triggeredBy" "CrawlJobTrigger" NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrawlJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceCitation" (
    "id" TEXT NOT NULL,
    "sourceableType" "SourceableType" NOT NULL,
    "sourceableId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceDocumentId" TEXT,
    "discoveredFrom" TEXT,
    "discoveryUrl" TEXT,
    "officialSourceUrl" TEXT,
    "role" "CitationRole" NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceCitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "University" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "region" TEXT,
    "type" "UniversityType",
    "foundedYear" INTEGER,
    "website" TEXT NOT NULL,
    "logoUrl" TEXT,
    "description" TEXT,
    "accreditation" TEXT[],
    "contactEmail" TEXT,
    "primarySourceId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "authorityLevel" "AuthorityLevel" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "lastVerifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "University_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Program" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "degreeLevel" "DegreeLevel" NOT NULL,
    "fieldOfStudy" TEXT NOT NULL,
    "fieldCategory" "FieldCategory" NOT NULL,
    "durationMonths" INTEGER,
    "instructionLanguages" TEXT[],
    "tuitionType" "TuitionType" NOT NULL,
    "tuitionAmount" DECIMAL(65,30),
    "tuitionCurrency" TEXT,
    "tuitionPeriod" "TuitionPeriod",
    "applicationFee" DECIMAL(65,30),
    "applicationFeeCurrency" TEXT,
    "intakes" TEXT[],
    "programUrl" TEXT NOT NULL,
    "description" TEXT,
    "creditSystem" TEXT,
    "primarySourceId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "authorityLevel" "AuthorityLevel" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "lastVerifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramRequirement" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "requirementType" "RequirementType" NOT NULL,
    "testName" TEXT,
    "operator" "RequirementOperator" NOT NULL,
    "value" TEXT NOT NULL,
    "unit" TEXT,
    "description" TEXT,
    "primarySourceId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "authorityLevel" "AuthorityLevel" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "lastVerifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgramRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationDeadline" (
    "id" TEXT NOT NULL,
    "programId" TEXT,
    "scholarshipId" TEXT,
    "deadlineType" "DeadlineType" NOT NULL,
    "date" TIMESTAMP(3),
    "dateText" TEXT,
    "intake" TEXT,
    "primarySourceId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "authorityLevel" "AuthorityLevel" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "lastVerifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationDeadline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FundingOpportunity" (
    "id" TEXT NOT NULL,
    "scholarshipId" TEXT NOT NULL,
    "universityId" TEXT,
    "programId" TEXT,
    "fundingType" "FundingType" NOT NULL,
    "coveragePercent" INTEGER,
    "coverageType" "ScholarshipCoverageType",
    "primarySourceId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "authorityLevel" "AuthorityLevel" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "lastVerifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FundingOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scholarship" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "providerName" TEXT NOT NULL,
    "providerType" "SourceType" NOT NULL,
    "country" TEXT,
    "amount" DECIMAL(65,30),
    "amountCurrency" TEXT,
    "coverageType" "ScholarshipCoverageType" NOT NULL,
    "description" TEXT,
    "applicationUrl" TEXT NOT NULL,
    "deadlineText" TEXT,
    "isRenewable" BOOLEAN,
    "discoveredFrom" TEXT,
    "discoveryUrl" TEXT,
    "officialSourceUrl" TEXT,
    "primarySourceId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "authorityLevel" "AuthorityLevel" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "lastVerifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scholarship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScholarshipEligibility" (
    "id" TEXT NOT NULL,
    "scholarshipId" TEXT NOT NULL,
    "criterionType" "EligibilityCriterionType" NOT NULL,
    "operator" "RequirementOperator" NOT NULL,
    "valueList" TEXT[],
    "numericValue" DOUBLE PRECISION,
    "textValue" TEXT,
    "description" TEXT,
    "primarySourceId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "authorityLevel" "AuthorityLevel" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "lastVerifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScholarshipEligibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "name" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nationality" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "currentEducationLevel" "DegreeLevel",
    "currentGpa" DOUBLE PRECISION,
    "gpaScale" DOUBLE PRECISION,
    "fieldOfStudy" TEXT,
    "desiredDegreeLevel" "DegreeLevel",
    "desiredFields" TEXT[],
    "preferredCountries" TEXT[],
    "budgetMaxPerYear" DECIMAL(65,30),
    "budgetCurrency" TEXT,
    "workExperienceMonths" INTEGER,
    "financialNeedSelfReported" BOOLEAN,
    "profileCompleteness" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentLanguageProficiency" (
    "id" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "testName" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "cefrLevel" TEXT,
    "testDate" TIMESTAMP(3),

    CONSTRAINT "StudentLanguageProficiency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "matchType" "MatchType" NOT NULL,
    "programId" TEXT,
    "scholarshipId" TEXT,
    "score" DOUBLE PRECISION NOT NULL,
    "matchStrength" "MatchStrength" NOT NULL,
    "factorScores" JSONB NOT NULL,
    "strengths" TEXT[],
    "missingRequirements" TEXT[],
    "warnings" TEXT[],
    "recommendedActions" TEXT[],
    "computedAt" TIMESTAMP(3) NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedOpportunity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "opportunityType" "MatchType" NOT NULL,
    "programId" TEXT,
    "scholarshipId" TEXT,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "reminderDate" TIMESTAMP(3),

    CONSTRAINT "SavedOpportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "opportunityType" "MatchType" NOT NULL,
    "programId" TEXT,
    "scholarshipId" TEXT,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'SAVED',
    "statusUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "decisionAt" TIMESTAMP(3),
    "decisionNotes" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationDocument" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "fileUrl" TEXT,
    "notes" TEXT,

    CONSTRAINT "ApplicationDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateIndex
CREATE INDEX "Source_type_country_idx" ON "Source"("type", "country");

-- CreateIndex
CREATE INDEX "Source_status_idx" ON "Source"("status");

-- CreateIndex
CREATE INDEX "SourceDocument_sourceId_extractionStatus_idx" ON "SourceDocument"("sourceId", "extractionStatus");

-- CreateIndex
CREATE INDEX "SourceDocument_checksum_idx" ON "SourceDocument"("checksum");

-- CreateIndex
CREATE INDEX "CrawlJob_sourceId_status_idx" ON "CrawlJob"("sourceId", "status");

-- CreateIndex
CREATE INDEX "SourceCitation_sourceableType_sourceableId_idx" ON "SourceCitation"("sourceableType", "sourceableId");

-- CreateIndex
CREATE UNIQUE INDEX "University_dedupeKey_key" ON "University"("dedupeKey");

-- CreateIndex
CREATE INDEX "University_country_idx" ON "University"("country");

-- CreateIndex
CREATE INDEX "University_verificationStatus_idx" ON "University"("verificationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Program_dedupeKey_key" ON "Program"("dedupeKey");

-- CreateIndex
CREATE INDEX "Program_universityId_idx" ON "Program"("universityId");

-- CreateIndex
CREATE INDEX "Program_degreeLevel_fieldCategory_idx" ON "Program"("degreeLevel", "fieldCategory");

-- CreateIndex
CREATE INDEX "Program_tuitionType_idx" ON "Program"("tuitionType");

-- CreateIndex
CREATE INDEX "ProgramRequirement_programId_requirementType_idx" ON "ProgramRequirement"("programId", "requirementType");

-- CreateIndex
CREATE INDEX "ApplicationDeadline_programId_idx" ON "ApplicationDeadline"("programId");

-- CreateIndex
CREATE INDEX "ApplicationDeadline_scholarshipId_idx" ON "ApplicationDeadline"("scholarshipId");

-- CreateIndex
CREATE INDEX "ApplicationDeadline_date_idx" ON "ApplicationDeadline"("date");

-- CreateIndex
CREATE INDEX "FundingOpportunity_scholarshipId_idx" ON "FundingOpportunity"("scholarshipId");

-- CreateIndex
CREATE INDEX "FundingOpportunity_universityId_idx" ON "FundingOpportunity"("universityId");

-- CreateIndex
CREATE INDEX "FundingOpportunity_programId_idx" ON "FundingOpportunity"("programId");

-- CreateIndex
CREATE UNIQUE INDEX "Scholarship_dedupeKey_key" ON "Scholarship"("dedupeKey");

-- CreateIndex
CREATE INDEX "Scholarship_country_idx" ON "Scholarship"("country");

-- CreateIndex
CREATE INDEX "Scholarship_verificationStatus_idx" ON "Scholarship"("verificationStatus");

-- CreateIndex
CREATE INDEX "ScholarshipEligibility_scholarshipId_criterionType_idx" ON "ScholarshipEligibility"("scholarshipId", "criterionType");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfile_userId_key" ON "StudentProfile"("userId");

-- CreateIndex
CREATE INDEX "StudentLanguageProficiency_studentProfileId_idx" ON "StudentLanguageProficiency"("studentProfileId");

-- CreateIndex
CREATE INDEX "Match_userId_matchType_idx" ON "Match"("userId", "matchType");

-- CreateIndex
CREATE INDEX "Match_programId_idx" ON "Match"("programId");

-- CreateIndex
CREATE INDEX "Match_scholarshipId_idx" ON "Match"("scholarshipId");

-- CreateIndex
CREATE INDEX "SavedOpportunity_userId_opportunityType_idx" ON "SavedOpportunity"("userId", "opportunityType");

-- CreateIndex
CREATE INDEX "Application_userId_status_idx" ON "Application"("userId", "status");

-- CreateIndex
CREATE INDEX "ApplicationDocument_applicationId_idx" ON "ApplicationDocument"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- AddForeignKey
ALTER TABLE "SourceDocument" ADD CONSTRAINT "SourceDocument_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceDocument" ADD CONSTRAINT "SourceDocument_crawlJobId_fkey" FOREIGN KEY ("crawlJobId") REFERENCES "CrawlJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrawlJob" ADD CONSTRAINT "CrawlJob_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceCitation" ADD CONSTRAINT "SourceCitation_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceCitation" ADD CONSTRAINT "SourceCitation_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "University" ADD CONSTRAINT "University_primarySourceId_fkey" FOREIGN KEY ("primarySourceId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_primarySourceId_fkey" FOREIGN KEY ("primarySourceId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramRequirement" ADD CONSTRAINT "ProgramRequirement_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramRequirement" ADD CONSTRAINT "ProgramRequirement_primarySourceId_fkey" FOREIGN KEY ("primarySourceId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationDeadline" ADD CONSTRAINT "ApplicationDeadline_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationDeadline" ADD CONSTRAINT "ApplicationDeadline_scholarshipId_fkey" FOREIGN KEY ("scholarshipId") REFERENCES "Scholarship"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationDeadline" ADD CONSTRAINT "ApplicationDeadline_primarySourceId_fkey" FOREIGN KEY ("primarySourceId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingOpportunity" ADD CONSTRAINT "FundingOpportunity_scholarshipId_fkey" FOREIGN KEY ("scholarshipId") REFERENCES "Scholarship"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingOpportunity" ADD CONSTRAINT "FundingOpportunity_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FundingOpportunity" ADD CONSTRAINT "FundingOpportunity_primarySourceId_fkey" FOREIGN KEY ("primarySourceId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scholarship" ADD CONSTRAINT "Scholarship_primarySourceId_fkey" FOREIGN KEY ("primarySourceId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScholarshipEligibility" ADD CONSTRAINT "ScholarshipEligibility_scholarshipId_fkey" FOREIGN KEY ("scholarshipId") REFERENCES "Scholarship"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScholarshipEligibility" ADD CONSTRAINT "ScholarshipEligibility_primarySourceId_fkey" FOREIGN KEY ("primarySourceId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentLanguageProficiency" ADD CONSTRAINT "StudentLanguageProficiency_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_scholarshipId_fkey" FOREIGN KEY ("scholarshipId") REFERENCES "Scholarship"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedOpportunity" ADD CONSTRAINT "SavedOpportunity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedOpportunity" ADD CONSTRAINT "SavedOpportunity_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedOpportunity" ADD CONSTRAINT "SavedOpportunity_scholarshipId_fkey" FOREIGN KEY ("scholarshipId") REFERENCES "Scholarship"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_scholarshipId_fkey" FOREIGN KEY ("scholarshipId") REFERENCES "Scholarship"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationDocument" ADD CONSTRAINT "ApplicationDocument_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
