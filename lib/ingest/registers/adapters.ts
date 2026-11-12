import { records } from "./csv";
import type { RegisterProgramme } from "./types";

/**
 * One adapter per national register. Each keeps master's and doctoral
 * programmes (bachelor's come later, as the plan sets out), reads only what
 * the register states, and never derives what it does not: no language for
 * a register without one, no fee for a register without one.
 */

const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s\-'(])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());

/** French titles take sentence case: "SCIENCES DE L'EDUCATION" -> "Sciences de l'education". */
const sentenceCase = (s: string) => {
  const lower = s.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
};

// ---------------------------------------------------------------------------
// Netherlands: DUO, Overzicht Erkenningen ho (CC BY)
// ---------------------------------------------------------------------------

const NL_FORM: Record<string, string> = { VOLTIJD: "Full-time", DEELTIJD: "Part-time", DUAAL: "Work and study (dual)" };

/**
 * Current recognised master's programmes. The file keeps history: a row per
 * record version, location and form of study. Only ACTUEEL records whose
 * intake is still open are read. A full-time programme's length follows from
 * its credits (60 ECTS is one full-time academic year, by definition).
 */
export function nlProgrammes(csv: string, today = new Date()): RegisterProgramme[] {
  const out: RegisterProgramme[] = [];
  for (const r of records(csv)) {
    if (r.NIVEAU !== "WO-MA" && r.NIVEAU !== "HBO-MA") continue;
    if (r.STATUS !== "ACTUEEL" || (r.INSTROOM_EINDDATUM && new Date(r.INSTROOM_EINDDATUM) <= today)) continue;
    const english = r.OPLEIDINGSEENHEID_INTERNATIONALE_NAAM;
    const dutch = r.OPLEIDINGSEENHEID_NAAM;
    if (!english && !dutch) continue;
    const ects = r.STUDIELASTEENHEID === "ECTS_PUNT" ? Number(r.STUDIELAST) || null : null;
    const mode = NL_FORM[r.VORM] ?? null;
    const city = r.PLAATSNAAM ? titleCase(r.PLAATSNAAM) : null;
    out.push({
      institution: { name: r.INSTELLINGSNAAM, aliases: r.BEVOEGD_GEZAG_NAAM ? [r.BEVOEGD_GEZAG_NAAM] : [], country: "NL", city, code: r.INSTELLINGSCODE },
      code: r.OPLEIDINGSEENHEIDCODE || r.ERKENDEOPLEIDINGSCODE,
      name: english || dutch,
      originalName: english && dutch && english !== dutch ? dutch : null,
      degreeLevel: "MASTER",
      fieldOfStudy: english || dutch,
      durationMonths: mode === "Full-time" && ects ? Math.round((ects / 60) * 12) : null,
      studyMode: mode,
      facts: [r.NIVEAU === "HBO-MA" ? "Professional master's (hbo)" : "Research university master's (wo)", ects ? `${ects} ECTS` : null, city].filter(Boolean).join(", "),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Australia: CRICOS (CC BY 2.5 AU)
// ---------------------------------------------------------------------------

const AU_LEVEL: Record<string, RegisterProgramme["degreeLevel"]> = {
  "Masters Degree (Coursework)": "MASTER",
  "Masters Degree (Research)": "MASTER",
  "Masters Degree (Extended)": "MASTER",
  "Doctoral Degree": "PHD",
};

/** "$13,300.00" -> 13300. */
function money(value: string): number | null {
  const n = Number(value.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Current master's and doctoral courses open to international students.
 * CRICOS states each course's language, length in weeks and its tuition fee
 * for the whole course.
 */
export function auProgrammes(coursesCsv: string, institutionsCsv: string): RegisterProgramme[] {
  const institutions = new Map(records(institutionsCsv).map((r) => [r["CRICOS Provider Code"], r]));
  const out: RegisterProgramme[] = [];
  for (const c of records(coursesCsv)) {
    const level = AU_LEVEL[c["Course Level"]];
    if (!level || c.Expired !== "No") continue;
    const providerCode = c["CRICOS Provider Code"];
    const inst = institutions.get(providerCode);
    const fullName = inst?.["Institution Name"] || c["Institution Name"];
    const name = fullName.replace(/\s*\([^)]*\)\s*$/, "");
    const weeks = Number(c["Duration (Weeks)"]) || null;
    const fee = money(c["Tuition Fee"]);
    const field = (c["Field of Education 1 Narrow Field"] || c["Field of Education 1 Broad Field"] || "").replace(/^\d+\s*-\s*/, "");
    out.push({
      institution: {
        name,
        aliases: [inst?.["Trading Name"], fullName].filter((a): a is string => Boolean(a) && a !== name),
        country: "AU",
        website: inst?.Website || null,
        city: inst?.["Postal Address City"] ? titleCase(inst["Postal Address City"]) : null,
        code: providerCode,
      },
      code: c["CRICOS Course Code"],
      name: c["Course Name"],
      degreeLevel: level,
      fieldOfStudy: field || c["Course Name"],
      durationMonths: weeks ? Math.round((weeks / 52) * 12) : null,
      instructionLanguages: c["Course Language"] ? [c["Course Language"]] : [],
      tuition: fee ? { amount: fee, currency: "AUD", period: "PER_PROGRAM" } : null,
      facts: [c["Course Level"], weeks ? `${weeks} weeks` : null, `CRICOS ${c["CRICOS Course Code"]}`].filter(Boolean).join(", "),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// France: Mon Master open data (Licence Ouverte 2.0)
// ---------------------------------------------------------------------------

/**
 * Every master's track open for applications on Mon Master, from the most
 * recent session in the file. Names stay in French: the platform gives no
 * English titles and none is invented.
 */
export function frProgrammes(csv: string): RegisterProgramme[] {
  const rows = records(csv);
  const latest = rows.reduce((m, r) => (r.session > m ? r.session : m), "");
  const out: RegisterProgramme[] = [];
  for (const r of rows) {
    if (r.session !== latest || !r.eta_nom || !r.mention) continue;
    const mention = sentenceCase(r.mention);
    const place = r.lieux.split("|")[0]?.match(/-\s*([^-()]+?)\s*\(\d+\)\s*$/)?.[1];
    const city = place ? titleCase(place) : null;
    out.push({
      institution: { name: r.eta_nom, country: "FR", city, code: r.eta_uai },
      code: r.inmp || r.ifc,
      name: r.parcours ? `Master ${mention}: ${r.parcours}` : `Master ${mention}`,
      degreeLevel: "MASTER",
      fieldOfStudy: r.disci_lib || mention,
      // The platform states no teaching language, and the programme's own page
      // is the only place to find it; saying so beats a silent blank.
      facts: [`Mention ${mention}`, r.parcours ? `parcours ${r.parcours}` : null, r.disci_lib, city].filter(Boolean).join(", ") + ". Mon Master does not state the teaching language",
    });
  }
  return out;
}
