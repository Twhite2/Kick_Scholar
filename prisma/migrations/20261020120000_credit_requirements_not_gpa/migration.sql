-- "210 ECTS credits" and "80 credit points" were extracted as MIN_GPA, so
-- matching read them as grades on a 100-point scale. They describe the size
-- of the previous degree, so they move to DEGREE_PREREQUISITE. The loader
-- reclassifies new rows the same way (isCreditRequirement in
-- lib/extraction/llm/gradeScale.ts).
UPDATE "ProgramRequirement"
SET "requirementType" = 'DEGREE_PREREQUISITE'
WHERE "requirementType" = 'MIN_GPA'
  AND unit ~* 'credit|\mects\M(?!\s*grade)|\mcp\M';
