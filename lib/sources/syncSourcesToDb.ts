import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { loadAllConfigs } from "./registry";
import type { SourceConfig } from "./schema";

/**
 * Idempotently upserts every source config (the file-based source of truth)
 * into the `Source` table (the queryable/joinable mirror carrying runtime
 * state like lastCrawledAt). Safe to re-run any time configs change.
 */
export async function syncSourcesToDb(prisma: PrismaClient): Promise<SourceConfig[]> {
  const configs = await loadAllConfigs(true);

  for (const config of configs) {
    await prisma.source.upsert({
      where: { id: config.id },
      update: {
        name: config.name,
        type: config.type,
        country: config.country,
        baseUrl: config.baseUrl,
        authorityLevel: config.authorityLevel,
        crawlFrequency: config.crawlFrequency,
        status: config.status,
        notes: config.notes ?? null,
      },
      create: {
        id: config.id,
        name: config.name,
        type: config.type,
        country: config.country,
        baseUrl: config.baseUrl,
        authorityLevel: config.authorityLevel,
        crawlFrequency: config.crawlFrequency,
        status: config.status,
        notes: config.notes ?? null,
      },
    });
  }

  return configs;
}

async function runAsCli() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });
  try {
    const configs = await syncSourcesToDb(prisma);
    console.log(`Synced ${configs.length} source config(s) to the database:`);
    for (const c of configs) {
      console.log(`  ${c.status.padEnd(9)} ${c.authorityLevel.padEnd(10)} ${c.id}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Only run as a script when invoked directly (`tsx lib/sources/syncSourcesToDb.ts`),
// not when imported by other modules (e.g. the future admin "sync sources" action).
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  runAsCli().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
