-- AlterTable
ALTER TABLE "University" ADD COLUMN     "externalIds" JSONB,
ADD COLUMN     "rorId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "University_rorId_key" ON "University"("rorId");

