/**
 * One programme as a national register states it (docs: "Programme data for
 * every institution", Part B). Adapters fill only what their register says;
 * everything else stays null and is shown as not published.
 */
export interface RegisterInstitution {
  /** The register's own name for it ("Universiteit van Amsterdam"). */
  name: string;
  /** Other names the register gives (a trading name). */
  aliases?: string[];
  country: string;
  website?: string | null;
  city?: string | null;
  /** The register's identifier (UAI, BRIN, CRICOS provider code), for the report. */
  code?: string | null;
}

export interface RegisterProgramme {
  institution: RegisterInstitution;
  /** The register's identifier for the programme, for de-duplication and the report. */
  code: string;
  /** The name students see: the register's English name where it gives one. */
  name: string;
  /** The name in the national language, when different. */
  originalName?: string | null;
  degreeLevel: "MASTER" | "PHD" | "BACHELOR" | "DIPLOMA";
  fieldOfStudy: string;
  durationMonths?: number | null;
  studyMode?: string | null;
  instructionLanguages?: string[];
  tuition?: { amount: number; currency: string; period: "PER_YEAR" | "PER_SEMESTER" | "PER_PROGRAM" } | null;
  /** One line of register facts for the description ("Master of Science, 120 ECTS, Amsterdam"). */
  facts: string;
}

export interface RegisterSource {
  sourceId: string;
  /** The dataset's own page, kept as every programme's source link. */
  datasetUrl: string;
}
