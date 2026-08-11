import { z } from "zod";

// Mirrors the Prisma SourceType/AuthorityLevel/CrawlFrequency/SourceStatus
// enums. Kept as a separate zod schema (rather than importing the Prisma
// enums directly) so `data/sources/configs/*.json` stays a plain,
// dependency-free config format that lib/sources/registry.ts can load
// without pulling in the generated Prisma client.
export const SourceTypeSchema = z.enum([
  "UNIVERSITY",
  "NATIONAL_EDUCATION_PORTAL",
  "GOVERNMENT",
  "SCHOLARSHIP_PROVIDER",
  "SCHOLARSHIP_AGGREGATOR",
  "EDUCATION_DATABASE",
]);

export const AuthorityLevelSchema = z.enum(["PRIMARY", "SECONDARY", "DISCOVERY"]);

export const CrawlFrequencySchema = z.enum(["DAILY", "WEEKLY", "MONTHLY", "MANUAL"]);

export const SourceStatusSchema = z.enum(["ACTIVE", "PAUSED", "ERROR", "DEPRECATED"]);

// A source is authoritative for at most one country, or none (multi-country
// aggregators like Bright Scholarship, or DAAD which is Germany-specific but
// happens to also list some non-German opportunities — still tagged "DE" as
// its primary jurisdiction).
export const SourceConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: SourceTypeSchema,
  country: z.string().length(2).nullable(),
  baseUrl: z.url(),
  authorityLevel: AuthorityLevelSchema,
  crawlFrequency: CrawlFrequencySchema.default("MANUAL"),
  status: SourceStatusSchema.default("ACTIVE"),
  seedUrls: z.array(z.url()).min(1),
  urlPatterns: z
    .object({
      include: z.array(z.string()).default([]),
      exclude: z.array(z.string()).default([]),
    })
    .default({ include: [], exclude: [] }),
  maxDepth: z.number().int().min(0).default(2),
  maxPages: z.number().int().min(1).default(25),
  rateLimitMs: z.number().int().min(0).default(3000),
  respectRobotsTxt: z.boolean().default(true),
  // Fixed post-load delay (seconds) before scraping — some sources are
  // client-rendered SPAs that need a beat after navigation before real
  // content is in the DOM (see crawler/crawl4ai_crawler.py).
  delayBeforeReturnHtmlSeconds: z.number().min(0).default(2),
  // Advisory only — hints for whoever is hand-authoring the extraction JSON
  // for this source (e.g. "listing pages use .program-card"). Never trusted
  // by the extractor itself; extraction always requires a sourceUrl + quote.
  extractionHints: z.record(z.string(), z.string()).optional(),
  notes: z.string().optional(),
});

export type SourceConfig = z.infer<typeof SourceConfigSchema>;
