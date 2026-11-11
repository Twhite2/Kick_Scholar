-- What a scholarship's amount is per ("a month"), and a programme's study mode
-- ("Full-time"), both as their sources state them.
ALTER TABLE "Scholarship" ADD COLUMN "amountPeriod" TEXT;
ALTER TABLE "Program" ADD COLUMN "studyMode" TEXT;
