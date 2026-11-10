-- When the student last opened Home, so the UI can say "4 new since Friday".
ALTER TABLE "User" ADD COLUMN "homeLastVisitedAt" TIMESTAMP(3);
