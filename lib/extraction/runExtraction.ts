import "dotenv/config";
import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { findParser } from "./parsers";
import { ExtractionFileSchema } from "./schemas";
import { extractionFilePath } from "./paths";
import { isCliEntrypoint } from "../cliEntrypoint";
import { enrichScholarship, enrichProgram } from "./llm/openaiExtractor";
import type { SourceDocumentInput } from "./types";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");

export interface ExtractionRunResult {
  documentsConsidered: number;
  parsed: number;
  skippedNoParser: number;
  skippedNoMarkdown: number;
  /** Documents left alone because an LLM-enriched file already exists. */
  skippedAlreadyEnriched: number;
  failed: number;
  /** Dotted paths a parser could not fill, with how often — this is the
   *  shopping list for the LLM stage, and its cost driver. */
  unfilledCounts: Record<string, number>;
  /** Documents sent to the model (only when --llm is on). */
  llmCalls: number;
  llmCostUsd: number;
  /** Facts the model returned that failed the verbatim-quote check. */
  llmQuotesRejected: number;
  llmEligibilityAdded: number;
  llmApplicabilityAdded: number;
  llmRequirementsAdded: number;
  warnings: string[];
}

/**
 * Applies deterministic parsers to crawled SourceDocuments and writes
 * data/extracted/<sourceId>/<id>.json files.
 *
 * Parser-only by design right now: this runs at zero API cost and proves the
 * crawl → extract → load path end to end. An LLM fallback slots in later for
 * the fields reported in `unfilledCounts` without changing anything
 * downstream, because every extractor emits the same ExtractionFile shape.
 */
interface DiskDocument {
  id: string;
  sourceId: string;
  url: string;
  markdownPath: string | null;
}

/**
 * Reconstructs the SourceDocument shape from the crawler's own on-disk
 * artifacts. Uses the same `${sourceId}:${checksum}` id runCrawlJob.ts
 * assigns, so extraction files land at identical paths either way.
 */
async function documentsFromDisk(
  sourceId: string | undefined,
  limit?: number,
): Promise<DiskDocument[]> {
  const rawRoot = path.join(REPO_ROOT, "data", "raw");
  const sourceDirs = sourceId
    ? [sourceId]
    : (await readdir(rawRoot, { withFileTypes: true }))
        .filter((e) => e.isDirectory())
        .map((e) => e.name);

  const out: DiskDocument[] = [];
  const seenChecksums = new Set<string>();

  for (const sid of sourceDirs) {
    const sourceDir = path.join(rawRoot, sid);
    let runs: string[];
    try {
      runs = (await readdir(sourceDir, { withFileTypes: true }))
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .sort()
        .reverse(); // newest run first
    } catch {
      continue;
    }

    for (const run of runs) {
      const runDir = path.join(sourceDir, run);
      let files: string[];
      try {
        files = (await readdir(runDir)).filter((f) => f.endsWith(".meta.json"));
      } catch {
        continue;
      }
      for (const file of files) {
        let meta: {
          url?: string;
          success?: boolean;
          checksum?: string;
          markdownPath?: string | null;
        };
        try {
          meta = JSON.parse(await readFile(path.join(runDir, file), "utf-8"));
        } catch {
          continue;
        }
        if (!meta.success || !meta.url || !meta.checksum || !meta.markdownPath) continue;
        // Same dedupe rule as runCrawlJob.ts: one document per fetched body.
        if (seenChecksums.has(meta.checksum)) continue;
        seenChecksums.add(meta.checksum);
        out.push({
          id: `${sid}:${meta.checksum}`,
          sourceId: sid,
          url: meta.url,
          markdownPath: meta.markdownPath,
        });
        if (limit && out.length >= limit) return out;
      }
    }
  }
  return out;
}

export async function runExtraction(
  prisma: PrismaClient,
  opts: {
    sourceId?: string;
    limit?: number;
    dryRun?: boolean;
    /**
     * Read crawled pages straight off disk instead of from SourceDocument
     * rows. Those rows are only written when a crawl *finishes*, but the
     * crawler now persists each page as it lands — so this allows extracting
     * from a multi-hour crawl that is still in flight.
     */
    fromDisk?: boolean;
    /**
     * Enrich parser output with LLM-extracted prose fields (eligibility,
     * applicability, admission requirements). Costs money; off by default so
     * a plain run stays free.
     */
    llm?: boolean;
    /** Stop after this much spend, as a safety rail on a long run. */
    maxUsd?: number;
    /**
     * Skip documents that already have an LLM-enriched extraction file.
     *
     * A long run is interrupted by ordinary things — a laptop sleeping, the
     * database VM suspending, a session ending. Without this, restarting one
     * re-sends every page that already succeeded and pays for it twice. The
     * test is whether the file on disk says `extractedBy: "claude-api"`, so a
     * parser-only file from an earlier free run is still picked up for
     * enrichment rather than mistaken for finished work.
     */
    skipEnriched?: boolean;
  } = {},
): Promise<ExtractionRunResult> {
  const result: ExtractionRunResult = {
    documentsConsidered: 0,
    parsed: 0,
    skippedNoParser: 0,
    skippedNoMarkdown: 0,
    skippedAlreadyEnriched: 0,
    failed: 0,
    unfilledCounts: {},
    llmCalls: 0,
    llmCostUsd: 0,
    llmQuotesRejected: 0,
    llmEligibilityAdded: 0,
    llmApplicabilityAdded: 0,
    llmRequirementsAdded: 0,
    warnings: [],
  };

  const documents = opts.fromDisk
    ? await documentsFromDisk(opts.sourceId, opts.limit)
    : await prisma.sourceDocument.findMany({
        where: opts.sourceId ? { sourceId: opts.sourceId } : undefined,
        orderBy: { fetchedAt: "desc" },
        ...(opts.limit ? { take: opts.limit } : {}),
      });

  for (const document of documents) {
    result.documentsConsidered += 1;

    if (opts.skipEnriched) {
      try {
        const existing = JSON.parse(
          await readFile(extractionFilePath(document.sourceId, document.id), "utf-8"),
        );
        if (existing?.extractedBy === "claude-api") {
          result.skippedAlreadyEnriched += 1;
          continue;
        }
      } catch {
        // No file, or unreadable — fall through and extract it.
      }
    }

    if (!document.markdownPath) {
      result.skippedNoMarkdown += 1;
      continue;
    }

    let markdown: string;
    try {
      markdown = await readFile(path.join(REPO_ROOT, document.markdownPath), "utf-8");
    } catch (err) {
      result.failed += 1;
      result.warnings.push(
        `${document.url}: could not read ${document.markdownPath}: ${(err as Error).message}`,
      );
      continue;
    }

    const input: SourceDocumentInput = {
      sourceDocumentId: document.id,
      sourceId: document.sourceId,
      url: document.url,
      markdown,
    };

    const parser = findParser(input);
    if (!parser) {
      result.skippedNoParser += 1;
      continue;
    }

    let parsed;
    try {
      parsed = parser.parse(input);
    } catch (err) {
      result.failed += 1;
      result.warnings.push(`${document.url}: parser threw: ${(err as Error).message}`);
      continue;
    }
    if (!parsed) {
      result.failed += 1;
      result.warnings.push(`${document.url}: parser did not recognise the page template`);
      continue;
    }

    // --- LLM enrichment ------------------------------------------------
    // The parser owns everything the page template guarantees; the model only
    // fills the prose fields it reported as unfilled. Quotes are verified
    // against the full page inside the extractor, so nothing ungrounded lands
    // in the file.
    let enriched = parsed.extraction;
    if (opts.llm && !(opts.maxUsd && result.llmCostUsd >= opts.maxUsd)) {
      const scholarship = enriched.scholarships[0];
      const program = enriched.programs[0];

      if (scholarship) {
        const r = await enrichScholarship(markdown, { focusText: parsed.focusText });
        result.llmCalls += 1;
        result.llmCostUsd += r.usage.costUsd;
        result.llmQuotesRejected += r.droppedQuotes.length;
        if (r.error) {
          result.warnings.push(`${document.url}: LLM error: ${r.error}`);
        } else if (r.fields) {
          result.llmEligibilityAdded += r.fields.eligibility.length;
          result.llmApplicabilityAdded += r.fields.applicability.length;
          enriched = {
            ...enriched,
            extractedBy: "claude-api",
            scholarships: [
              {
                ...scholarship,
                // coverageType stays with the parser: it derives STIPEND
                // deterministically from "per month" wording, whereas the
                // model returned three different answers for one page.
                eligibility: r.fields.eligibility.map((e) => ({
                  criterionType: e.criterionType,
                  operator: e.operator,
                  valueList: e.valueList,
                  numericValue: e.numericValue,
                  textValue: e.textValue,
                  sourceQuote: e.sourceQuote,
                  sourceUrl: null,
                })),
                applicability: r.fields.applicability.map((a) => ({
                  countries: a.countries,
                  degreeLevels: a.degreeLevels,
                  fieldCategories: a.fieldCategories,
                  institutionTypes: a.institutionTypes,
                  sourceQuote: a.sourceQuote,
                  sourceUrl: null,
                })),
              },
            ],
          };
        }
      } else if (program) {
        const r = await enrichProgram(markdown, { focusText: parsed.focusText });
        result.llmCalls += 1;
        result.llmCostUsd += r.usage.costUsd;
        result.llmQuotesRejected += r.droppedQuotes.length;
        if (r.error) {
          result.warnings.push(`${document.url}: LLM error: ${r.error}`);
        } else if (r.fields) {
          result.llmRequirementsAdded += r.fields.requirements.length;
          enriched = {
            ...enriched,
            extractedBy: "claude-api",
            programs: [
              {
                ...program,
                fieldCategory:
                  program.fieldCategory === "OTHER" ? r.fields.fieldCategory : program.fieldCategory,
                requirements: r.fields.requirements.map((q) => ({
                  requirementType: q.requirementType,
                  testName: q.testName,
                  operator: q.operator,
                  value: q.value,
                  unit: q.unit,
                  sourceQuote: q.sourceQuote,
                  sourceUrl: null,
                })),
              },
            ],
          };
        }
      }
    }

    // Validate before writing — a parser bug must fail here, not silently
    // produce a file that breaks the loader later.
    const validated = ExtractionFileSchema.safeParse(enriched);
    if (!validated.success) {
      result.failed += 1;
      result.warnings.push(
        `${document.url}: parser output failed schema validation:\n` +
          validated.error.issues
            .map((i) => `    - ${i.path.join(".")}: ${i.message}`)
            .join("\n"),
      );
      continue;
    }

    for (const field of parsed.coverage.unfilled) {
      result.unfilledCounts[field] = (result.unfilledCounts[field] ?? 0) + 1;
    }
    for (const warning of parsed.coverage.warnings) {
      result.warnings.push(`${document.url}: ${warning}`);
    }

    if (!opts.dryRun) {
      const outPath = extractionFilePath(document.sourceId, document.id);
      await mkdir(path.dirname(outPath), { recursive: true });
      await writeFile(outPath, `${JSON.stringify(validated.data, null, 2)}\n`, "utf-8");
      if (!opts.fromDisk) {
        await prisma.sourceDocument.update({
          where: { id: document.id },
          data: { extractionStatus: "EXTRACTED" },
        });
      }
    }

    result.parsed += 1;
  }

  return result;
}

async function runAsCli() {
  const args = process.argv.slice(2);
  const flag = (name: string): string | undefined => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
  };

  const sourceId = flag("source-id");
  const limitRaw = flag("limit");
  const dryRun = args.includes("--dry-run");
  const fromDisk = args.includes("--from-disk");
  const llm = args.includes("--llm");
  const skipEnriched = args.includes("--skip-enriched");
  const maxUsdRaw = flag("max-usd");

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });
  try {
    const result = await runExtraction(prisma, {
      sourceId,
      limit: limitRaw ? Number(limitRaw) : undefined,
      dryRun,
      fromDisk,
      llm,
      skipEnriched,
      maxUsd: maxUsdRaw ? Number(maxUsdRaw) : undefined,
    });

    console.log(
      `\n${dryRun ? "[dry run] " : ""}Extraction over ${result.documentsConsidered} document(s):`,
    );
    console.log(`  parsed              ${result.parsed}`);
    console.log(`  no parser for src   ${result.skippedNoParser}`);
    console.log(`  no markdown on disk ${result.skippedNoMarkdown}`);
    if (result.skippedAlreadyEnriched > 0) {
      console.log(`  already enriched    ${result.skippedAlreadyEnriched}  (skipped, not re-billed)`);
    }
    console.log(`  failed              ${result.failed}`);
    if (result.llmCalls > 0) {
      console.log(`
  LLM enrichment (${process.env.EXTRACTION_MODEL ?? "gpt-4o-mini"}):`);
      console.log(`    calls             ${result.llmCalls}`);
      console.log(`    eligibility added ${result.llmEligibilityAdded}`);
      console.log(`    applicability     ${result.llmApplicabilityAdded}`);
      console.log(`    requirements      ${result.llmRequirementsAdded}`);
      console.log(`    quotes rejected   ${result.llmQuotesRejected}`);
      console.log(`    cost              $${result.llmCostUsd.toFixed(4)}`);
    }

    const unfilled = Object.entries(result.unfilledCounts).sort((a, b) => b[1] - a[1]);
    if (unfilled.length) {
      console.log(`\n  Fields needing interpretation (the LLM stage's workload):`);
      for (const [field, count] of unfilled) {
        console.log(`    ${String(count).padStart(5)}  ${field}`);
      }
    }
    if (result.warnings.length) {
      console.log(`\n  Warnings (${result.warnings.length}):`);
      for (const w of result.warnings.slice(0, 20)) console.log(`    - ${w}`);
      if (result.warnings.length > 20) {
        console.log(`    … and ${result.warnings.length - 20} more`);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

if (isCliEntrypoint(import.meta.url)) {
  runAsCli().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
