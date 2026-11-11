import "dotenv/config";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { parseCsvTable, pick, type CsvTable } from "./csv";
import { inferFieldCategory } from "../../extraction/parsers/fieldCategory";
import { extractionFilePath } from "../../extraction/paths";
import { ExtractionFileSchema, type ExtractionFile } from "../../extraction/schemas";
import { isCliEntrypoint } from "../../cliEntrypoint";

/**
 * Imports UK degree programmes from the Discover Uni dataset.
 *
 * Why a dataset rather than a crawl, and why not UCAS: Discover Uni is
 * published by HESA for the Office for Students and the UK funding bodies as
 * a bulk download of XML and CSV, refreshed weekly. It is the same reasoning
 * that put ROR in place of WHED - when the authority publishes the data
 * properly, scraping a search page for it is strictly worse.
 *
 * The download is NOT automated. hesa.ac.uk returns HTTP 403 to every
 * programmatic client tried, including a browser user agent, so the file has
 * to be fetched by hand from https://www.hesa.ac.uk/kisdata and pointed at
 * with --dir. Pretending otherwise would produce an importer that works only
 * on the machine it was written on.
 *
 * Output is extraction files, not direct database writes, so this inherits
 * the loader's university matching, deduplication and provenance rather than
 * reimplementing them. That matters most for attaching courses to the UK
 * institutions already imported from ROR.
 *
 *   npm run ingest:discoveruni -- --dir path/to/unzipped-dataset
 */

const SOURCE_ID = "src-discover-uni";

/** Where a course page lives, when the dataset gives one. */
const DISCOVER_UNI_COURSE = "https://discoveruni.gov.uk";

/**
 * Study mode and length from a KISCOURSE row. KISMODE: 1 full-time,
 * 2 part-time, 3 both. NUMSTAGE counts the course's stages, which are years
 * for full-time study; a part-time stage is not a year, so no length is
 * claimed for part-time-only courses.
 */
export function courseShape(row: Record<string, string>): { studyMode: string | null; durationMonths: number | null } {
  // The release pads the code ("01"), so compare it as a number.
  const raw = pick(row, "KISMODE");
  const mode = /^\d+$/.test(raw) ? Number(raw) : null;
  const studyMode = mode === 1 ? "Full-time" : mode === 2 ? "Part-time" : mode === 3 ? "Full-time or part-time" : null;
  const stages = Number(pick(row, "NUMSTAGE"));
  const fullTime = mode === 1 || mode === 3;
  const durationMonths = fullTime && Number.isInteger(stages) && stages > 0 && stages <= 8 ? stages * 12 : null;
  return { studyMode, durationMonths };
}

export function mergeModes(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b || a === b) return a;
  return "Full-time or part-time";
}

export interface DiscoverUniResult {
  institutionsRead: number;
  coursesRead: number;
  coursesWritten: number;
  skippedNoTitle: number;
  skippedNoInstitution: number;
  skippedUnknownLevel: number;
  filesWritten: number;
  warnings: string[];
}

/** Finds a CSV in the unzipped release, whatever case the release used. */
async function findCsv(dir: string, ...names: string[]): Promise<string | null> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const name of names) {
    const hit = entries.find(
      (e) => e.isFile() && e.name.toUpperCase() === `${name.toUpperCase()}.CSV`,
    );
    if (hit) return path.join(dir, hit.name);
  }
  // Releases have nested the CSVs inside a folder more than once.
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const nested = await findCsv(path.join(dir, entry.name), ...names);
    if (nested) return nested;
  }
  return null;
}

async function readTable(file: string): Promise<CsvTable> {
  return parseCsvTable(await readFile(file, "utf-8"));
}

/**
 * Restores normal casing to names the release shouts.
 *
 * "NOTTINGHAM TRENT UNIVERSITY" is the same institution as "Nottingham Trent
 * University", but it will not match one, and it reads badly in the product.
 * Names that are already mixed case are left exactly as published.
 */
function titleCaseIfShouting(name: string): string {
  const value = name.trim();
  if (!value || value !== value.toUpperCase()) return value;
  return value
    .toLowerCase()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
    // Keep the small words small, except as the first word.
    .replace(/\s(Of|The|And|For|In|At)\b/g, (m) => m.toLowerCase());
}

/**
 * Turns the release's bare hostnames into absolute URLs.
 *
 * Returns empty for anything that still will not parse, so a malformed entry
 * is skipped rather than stored as a broken link.
 */
export function normaliseUrl(raw: string): string {
  const value = raw.trim();
  if (!value) return "";
  const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(candidate);
    return url.hostname.includes(".") ? url.toString() : "";
  } catch {
    return "";
  }
}

/**
 * Classifies a course by the qualification it awards, using the code table the
 * release ships in KISAIM.csv.
 *
 * KISLEVEL is the obvious column and the wrong one. It has exactly two values:
 * 03 covers first degrees AND integrated master's (MEng, MSci, MPhys), while
 * 04 covers sub-degree awards (HND, FdSc, DipHE, CertHE). Mapping from it
 * would file an MEng as a bachelor's and an HND as a first degree.
 *
 * The award label is unambiguous, so that is what this reads. It also uses the
 * dataset's own table rather than a hard-coded list, so a new qualification in
 * a later release is classified rather than dropped.
 *
 * Note for anyone matching UK scholarships against this: Discover Uni covers
 * undergraduate study only. The master's awards here are INTEGRATED master's,
 * entered from school at 18, not the one-year taught master's that Chevening
 * and Commonwealth fund. There are no standalone postgraduate courses in this
 * dataset at all.
 */
export function degreeLevelFromAward(label: string): string | null {
  const l = label.trim();
  if (!l) return null;

  // Sub-degree awards, checked first because "FdSc" would otherwise look like
  // a bachelor's by its trailing "Sc".
  if (/^(HND|HNC|FD|FdA|FdSc|FDA|FDS|FDEng|FDArts|FDEd|FdEng)/i.test(l)) return "DIPLOMA";
  if (/^(DipHE|Diploma|Graduate Diploma|PGDip)/i.test(l)) return "DIPLOMA";
  if (/^(CertHE|Certificate|TQFE|PGCE|PGCert)/i.test(l)) return "CERTIFICATE";

  // Medical and dental first degrees look like master's but are undergraduate,
  // so they are claimed before the general M rule below.
  if (/^(MB|MBBS|MBChB|MBBCh|MBBChir)$/i.test(l)) return "BACHELOR";

  // Doctorates, which this dataset is not expected to contain.
  if (/^(PhD|DPhil|EdD|DBA)$/i.test(l)) return "PHD";

  // Every remaining M-award in this release is an integrated master's: MEng,
  // MSci, MArch, MOptom, MLaw, MDes and about thirty more. Enumerating them
  // left 275 courses classified as nothing, so the rule is general and the
  // exceptions above are explicit.
  if (/^M[A-Za-z]/i.test(l)) return "MASTER";

  // First degrees, including the single-letter professional ones.
  if (/^(B[A-Za-z]*|LLB|BVMS|BVSc)/i.test(l)) return "BACHELOR";

  return null;
}

export async function importDiscoverUni(
  dir: string,
  opts: { limit?: number; dryRun?: boolean } = {},
): Promise<DiscoverUniResult> {
  const result: DiscoverUniResult = {
    institutionsRead: 0,
    coursesRead: 0,
    coursesWritten: 0,
    skippedNoTitle: 0,
    skippedNoInstitution: 0,
    skippedUnknownLevel: 0,
    filesWritten: 0,
    warnings: [],
  };

  const institutionFile = await findCsv(dir, "INSTITUTION");
  const courseFile = await findCsv(dir, "KISCOURSE", "COURSE");
  const awardFile = await findCsv(dir, "KISAIM");
  if (!institutionFile || !courseFile) {
    throw new Error(
      `Could not find INSTITUTION.csv and KISCOURSE.csv under ${dir}.\n` +
        `Unzip the Discover Uni release from https://www.hesa.ac.uk/kisdata and point --dir at it.`,
    );
  }

  const institutions = await readTable(institutionFile);
  const courses = await readTable(courseFile);

  // KISAIMCODE -> award label ("021" -> "BSc"), from the release itself.
  const awardLabel = new Map<string, string>();
  if (awardFile) {
    for (const row of (await readTable(awardFile)).rows) {
      const code = pick(row, "KISAIMCODE");
      const label = pick(row, "KISAIMLABEL", "LABEL");
      if (code && label) awardLabel.set(code, label);
    }
  } else {
    result.warnings.push(
      "KISAIM.csv not found - degree levels cannot be derived from the award and every course will be skipped",
    );
  }
  result.institutionsRead = institutions.rows.length;
  result.coursesRead = courses.rows.length;

  // Fail loudly on an unexpected schema rather than silently writing nothing:
  // a renamed column should look like a broken release, not an empty import.
  const nameOf = new Map<string, { name: string; website: string }>();
  let institutionsWithoutWebsite = 0;
  for (const row of institutions.rows) {
    const ukprn = pick(row, "UKPRN", "PUBUKPRN");
    // Trading name first. The release records legal names - "University of
    // Glasgow Court", "The Nottingham Trent University", "Prifysgol
    // Aberystwyth" - which match nothing in a catalogue built from common
    // names, and it ships the common name alongside precisely for this.
    // Some are shouted in the source, so casing is normalised.
    const name =
      titleCaseIfShouting(pick(row, "FIRST_TRADING_NAME", "TRADING_NAME")) ||
      pick(row, "LEGAL_NAME", "LEGALNAME", "NAME", "INSTITUTION");
    // 408 of the 496 providers publish a bare hostname ("www.anglia.ac.uk")
    // and only 26 include a scheme, so the schema's URL check rejected nearly
    // every institution. Adding https:// is a formatting fix, not a claim:
    // the host is exactly what the release states.
    const website = normaliseUrl(
      pick(row, "PROVURL", "INSTURL", "WEBSITE", "URL", "INSTITUTIONURL"),
    );
    if (!ukprn || !name) continue;
    if (!website) {
      // The schema requires a real website and the loader matches on it.
      // Inventing one would corrupt deduplication against the institutions
      // already imported from ROR, so the courses are skipped instead.
      institutionsWithoutWebsite += 1;
      continue;
    }
    nameOf.set(ukprn, { name, website });
  }
  if (institutionsWithoutWebsite > 0) {
    result.warnings.push(
      `${institutionsWithoutWebsite} institution(s) had no website column and were skipped rather than given a fabricated one`,
    );
  }
  if (nameOf.size === 0) {
    throw new Error(
      `No institutions could be read from ${path.basename(institutionFile)}.\n` +
        `Headers present: ${institutions.headers.join(", ")}\n` +
        `Expected UKPRN, a legal-name column and a provider-URL column. The release schema may have changed.`,
    );
  }

  // One extraction file per institution: the loader resolves a programme to
  // its university by name within the file, so grouping this way lets a whole
  // institution's courses attach in one pass.
  const byInstitution = new Map<string, ExtractionFile["programs"]>();

  for (const row of courses.rows) {
    if (opts.limit && result.coursesWritten >= opts.limit) break;

    const ukprn = pick(row, "UKPRN", "PUBUKPRN");
    const institution = ukprn ? nameOf.get(ukprn) : undefined;
    if (!institution) {
      result.skippedNoInstitution += 1;
      continue;
    }

    const title = pick(row, "TITLE", "ENGTITLE", "COURSETITLE", "KISCOURSETITLE");
    if (!title) {
      result.skippedNoTitle += 1;
      continue;
    }

    const award = awardLabel.get(pick(row, "KISAIMCODE")) ?? "";
    const degreeLevel = degreeLevelFromAward(award);
    if (!degreeLevel) {
      // Skipped rather than defaulted: a wrong degree level silently
      // mis-matches every student against this course.
      result.skippedUnknownLevel += 1;
      continue;
    }

    const courseUrl =
      normaliseUrl(pick(row, "CRSEURL", "COURSEURL", "URL")) || DISCOVER_UNI_COURSE;
    const fieldCategory = inferFieldCategory(title) ?? "OTHER";

    const { studyMode, durationMonths } = courseShape(row);
    const list = byInstitution.get(institution.name) ?? [];
    // The release lists full-time and part-time versions of one course as
    // separate rows; the loader keeps one programme per course, so merge them.
    const twin = list.find((p) => p.name === title && p.degreeLevel === (degreeLevel as never));
    if (twin) {
      twin.studyMode = mergeModes(twin.studyMode, studyMode);
      twin.durationMonths = twin.durationMonths ?? durationMonths;
      continue;
    }
    list.push({
      universityName: institution.name,
      // Taken from the release, never invented: the loader matches on it when
      // attaching courses to the institutions already imported from ROR.
      universityWebsite: institution.website,
      name: title,
      degreeLevel: degreeLevel as never,
      fieldOfStudy: title,
      fieldCategory: fieldCategory as never,
      durationMonths,
      instructionLanguages: ["English"],
      // Fees are published per fee regime and per year, which this importer
      // does not attempt to resolve, so nothing is claimed.
      tuitionType: "UNKNOWN" as never,
      tuitionAmount: null,
      tuitionCurrency: null,
      tuitionPeriod: null as never,
      intakes: [],
      studyMode,
      programUrl: courseUrl,
      description: award ? `Leads to a ${award}.` : null,
      sourceUrl: courseUrl,
      sourceQuote: title,
      requirements: [],
      deadlines: [],
    });
    byInstitution.set(institution.name, list);
    result.coursesWritten += 1;
  }

  if (opts.dryRun) return result;

  for (const [institutionName, programs] of byInstitution) {
    // A stable id per institution, so re-importing overwrites the same file
    // instead of accumulating a new one each week.
    const id = `${SOURCE_ID}:${createHash("sha256").update(institutionName).digest("hex").slice(0, 16)}`;
    const extraction: ExtractionFile = {
      sourceId: SOURCE_ID,
      sourceDocumentId: id,
      extractedBy: "manual",
      extractedAt: new Date().toISOString(),
      universities: [],
      programs,
      scholarships: [],
    };

    const validated = ExtractionFileSchema.safeParse(extraction);
    if (!validated.success) {
      result.warnings.push(
        `${institutionName}: ${validated.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
      );
      continue;
    }

    const outPath = extractionFilePath(SOURCE_ID, id);
    await mkdir(path.dirname(outPath), { recursive: true });
    await writeFile(outPath, `${JSON.stringify(validated.data, null, 2)}\n`, "utf-8");
    result.filesWritten += 1;
  }

  return result;
}

async function runAsCli() {
  const args = process.argv.slice(2);
  const flag = (name: string): string | undefined => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
  };

  const dir = flag("dir");
  if (!dir || !existsSync(dir)) {
    console.error(
      "Usage: npm run ingest:discoveruni -- --dir <unzipped dataset directory>\n\n" +
        "The Discover Uni dataset is a free download, but hesa.ac.uk refuses\n" +
        "programmatic clients (HTTP 403), so fetch and unzip it by hand:\n\n" +
        "  1. https://www.hesa.ac.uk/kisdata\n" +
        "  2. unzip the release\n" +
        "  3. npm run ingest:discoveruni -- --dir <that folder>\n",
    );
    process.exit(1);
  }

  const limitRaw = flag("limit");
  const result = await importDiscoverUni(dir, {
    limit: limitRaw ? Number(limitRaw) : undefined,
    dryRun: args.includes("--dry-run"),
  });

  console.log(`\nDiscover Uni import${args.includes("--dry-run") ? " [dry run]" : ""}:`);
  console.log(`  institutions read     ${result.institutionsRead.toLocaleString()}`);
  console.log(`  courses read          ${result.coursesRead.toLocaleString()}`);
  console.log(`  courses written       ${result.coursesWritten.toLocaleString()}`);
  console.log(`  extraction files      ${result.filesWritten.toLocaleString()}`);
  console.log(`\n  skipped - no title            ${result.skippedNoTitle.toLocaleString()}`);
  console.log(`  skipped - unknown institution ${result.skippedNoInstitution.toLocaleString()}`);
  console.log(`  skipped - unknown level       ${result.skippedUnknownLevel.toLocaleString()}`);
  if (result.warnings.length > 0) {
    console.log(`\n  Warnings (${result.warnings.length}):`);
    for (const w of result.warnings.slice(0, 10)) console.log(`    - ${w}`);
  }
  if (!args.includes("--dry-run") && result.filesWritten > 0) {
    console.log(`\nNext:  npm run pipeline:load -- data/extracted/${SOURCE_ID}`);
  }
}

if (isCliEntrypoint(import.meta.url)) {
  runAsCli().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
