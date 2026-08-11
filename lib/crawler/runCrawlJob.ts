import "dotenv/config";
import { spawn } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import type { CrawlManifest } from "./types";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");
const VENV_PYTHON = path.join(REPO_ROOT, "crawler", ".venv", "bin", "python");
const RUN_CRAWL_SCRIPT = path.join(REPO_ROOT, "crawler", "run_crawl.py");
const CONFIGS_DIR = path.join(REPO_ROOT, "data", "sources", "configs");

export interface RunCrawlJobResult {
  crawlJobId: string;
  status: "SUCCESS" | "FAILED" | "PARTIAL";
  pagesCrawled: number;
  pagesFailed: number;
  newDocuments: number;
}

async function findConfigPath(sourceId: string): Promise<string> {
  for (const file of await readdir(CONFIGS_DIR)) {
    if (!file.endsWith(".json")) continue;
    const full = path.join(CONFIGS_DIR, file);
    const raw = JSON.parse(await readFile(full, "utf-8"));
    if (raw.id === sourceId) return full;
  }
  throw new Error(`No source config found for id "${sourceId}"`);
}

/**
 * Orchestrates one crawl run for a configured source: creates a CrawlJob row,
 * spawns the Python Crawl4AI CLI (crawler/run_crawl.py), streams its
 * JSON-lines progress into that row, then reads the manifest it wrote and
 * upserts SourceDocument rows from it.
 *
 * Node owns orchestration and every DB write; Python only crawls and writes
 * files to data/raw/ — this function is the entire boundary between them.
 * Callable from an admin "trigger crawl" action or as a CLI
 * (`tsx lib/crawler/runCrawlJob.ts <source-id> [maxPages]`).
 */
export async function runCrawlJob(
  prisma: PrismaClient,
  sourceId: string,
  opts: { maxPages?: number } = {},
): Promise<RunCrawlJobResult> {
  const configPath = await findConfigPath(sourceId);

  const crawlJob = await prisma.crawlJob.create({
    data: { sourceId, status: "RUNNING", triggeredBy: "MANUAL" },
  });

  const args = ["run_crawl.py", "--source-id", sourceId, "--config", configPath];
  if (opts.maxPages) args.push("--max-pages", String(opts.maxPages));

  const child = spawn(VENV_PYTHON, args, { cwd: path.dirname(RUN_CRAWL_SCRIPT) });

  let manifestPath: string | null = null;
  let pagesDiscovered = 0;
  let pagesCrawled = 0;
  let pagesFailed = 0;
  const errorLines: string[] = [];

  const rl = createInterface({ input: child.stdout });
  for await (const line of rl) {
    let event: Record<string, unknown>;
    try {
      event = JSON.parse(line);
    } catch {
      continue; // non-JSON stdout noise (crawl4ai's own console output)
    }
    if (event.type === "progress") {
      pagesCrawled = Number(event.pagesCrawled ?? pagesCrawled);
    }
    if (event.type === "complete") {
      manifestPath = String(event.manifestPath);
      pagesCrawled = Number(event.pagesCrawled ?? pagesCrawled);
      pagesFailed = Number(event.pagesFailed ?? pagesFailed);
    }
    if (event.type === "error") {
      errorLines.push(String(event.message));
    }
    await prisma.crawlJob.update({
      where: { id: crawlJob.id },
      data: { pagesDiscovered, pagesCrawled, pagesFailed },
    });
  }

  const stderrChunks: Buffer[] = [];
  child.stderr.on("data", (chunk) => stderrChunks.push(chunk));

  const exitCode: number = await new Promise((resolve) => child.on("close", resolve));

  let newDocuments = 0;
  if (manifestPath) {
    const manifest: CrawlManifest = JSON.parse(
      await readFile(path.join(REPO_ROOT, manifestPath), "utf-8"),
    );
    pagesDiscovered = manifest.pagesDiscovered;
    pagesCrawled = manifest.pagesCrawled;
    pagesFailed = manifest.pagesFailed;

    for (const doc of manifest.documents) {
      if (!doc.success) continue;
      // No natural unique key on (sourceId, url) in the schema — dedupe on
      // (sourceId, checksum) instead, unique per fetched body.
      const id = `${sourceId}:${doc.checksum}`;
      await prisma.sourceDocument.upsert({
        where: { id },
        update: {
          httpStatus: doc.httpStatus ?? 0,
          fetchedAt: new Date(doc.fetchedAt),
          rawHtmlPath: doc.rawHtmlPath,
          markdownPath: doc.markdownPath,
        },
        create: {
          id,
          sourceId,
          crawlJobId: crawlJob.id,
          url: doc.url,
          fetchedAt: new Date(doc.fetchedAt),
          httpStatus: doc.httpStatus ?? 0,
          contentType: "MARKDOWN",
          rawHtmlPath: doc.rawHtmlPath,
          markdownPath: doc.markdownPath,
          checksum: doc.checksum ?? "",
          extractionStatus: "PENDING",
        },
      });
      newDocuments += 1;
    }
  }

  const status: RunCrawlJobResult["status"] =
    exitCode !== 0 || pagesCrawled === 0
      ? "FAILED"
      : pagesFailed > 0
        ? "PARTIAL"
        : "SUCCESS";

  await prisma.crawlJob.update({
    where: { id: crawlJob.id },
    data: {
      status,
      finishedAt: new Date(),
      pagesDiscovered,
      pagesCrawled,
      pagesFailed,
      newDocuments,
      errorLog:
        [...errorLines, Buffer.concat(stderrChunks).toString("utf-8")]
          .filter(Boolean)
          .join("\n")
          .slice(0, 8000) || null,
    },
  });

  await prisma.source.update({
    where: { id: sourceId },
    data: {
      lastCrawledAt: new Date(),
      ...(status !== "FAILED" ? { lastSuccessfulCrawlAt: new Date() } : {}),
    },
  });

  return { crawlJobId: crawlJob.id, status, pagesCrawled, pagesFailed, newDocuments };
}

async function runAsCli() {
  const [, , sourceId, maxPagesArg] = process.argv;
  if (!sourceId) {
    console.error("Usage: tsx lib/crawler/runCrawlJob.ts <source-id> [maxPages]");
    process.exit(1);
  }
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });
  try {
    const result = await runCrawlJob(prisma, sourceId, {
      maxPages: maxPagesArg ? Number(maxPagesArg) : undefined,
    });
    console.log(result);
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  runAsCli().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
