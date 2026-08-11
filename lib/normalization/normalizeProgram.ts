import type { ExtractedProgram } from "../extraction/schemas";
import { canonicalizeUrl } from "./canonicalUrl";
import { programDedupeKey } from "./generateDedupeKey";

export interface NormalizedProgram {
  dedupeKey: string;
  universityDedupeKey: string;
  name: string;
  degreeLevel: ExtractedProgram["degreeLevel"];
  fieldOfStudy: string;
  fieldCategory: ExtractedProgram["fieldCategory"];
  durationMonths: number | null;
  instructionLanguages: string[];
  tuitionType: ExtractedProgram["tuitionType"];
  tuitionAmount: number | null;
  tuitionCurrency: string | null;
  tuitionPeriod: ExtractedProgram["tuitionPeriod"];
  intakes: string[];
  programUrl: string;
  description: string | null;
  warnings: string[];
}

export function normalizeProgram(
  input: ExtractedProgram,
  universityDedupeKey: string,
): NormalizedProgram {
  const warnings: string[] = [];

  // Never let a UNKNOWN/VARIES tuitionType carry a stray amount through —
  // the extraction-time validator should already have caught this, but
  // normalization is the last line of defense before it reaches the DB.
  const tuitionAmount = input.tuitionType === "PAID" ? input.tuitionAmount : null;
  const tuitionCurrency = input.tuitionType === "PAID" ? input.tuitionCurrency : null;
  if (input.tuitionType !== "PAID" && (input.tuitionAmount !== null || input.tuitionCurrency !== null)) {
    warnings.push(`Dropped stray tuitionAmount/Currency on a ${input.tuitionType} program.`);
  }

  return {
    dedupeKey: programDedupeKey(universityDedupeKey, input.name, input.degreeLevel),
    universityDedupeKey,
    name: input.name.trim(),
    degreeLevel: input.degreeLevel,
    fieldOfStudy: input.fieldOfStudy.trim(),
    fieldCategory: input.fieldCategory,
    durationMonths: input.durationMonths,
    instructionLanguages: input.instructionLanguages.map((l) => l.trim()).filter(Boolean),
    tuitionType: input.tuitionType,
    tuitionAmount,
    tuitionCurrency,
    tuitionPeriod: input.tuitionPeriod,
    intakes: input.intakes.map((i) => i.trim()).filter(Boolean),
    programUrl: canonicalizeUrl(input.programUrl),
    description: input.description?.trim() || null,
    warnings,
  };
}
