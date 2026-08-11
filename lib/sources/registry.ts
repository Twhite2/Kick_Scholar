import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { SourceConfigSchema, type SourceConfig } from "./schema";

const CONFIGS_DIR = path.join(process.cwd(), "data", "sources", "configs");

let cache: SourceConfig[] | null = null;

/**
 * Loads and validates every `data/sources/configs/*.json` file. This is the
 * one place new sources plug in — adding a country/source is one JSON file
 * here, never a change to crawler/extraction/normalization/dedup/verification
 * code.
 */
export async function loadAllConfigs(forceReload = false): Promise<SourceConfig[]> {
  if (cache && !forceReload) return cache;

  const files = (await readdir(CONFIGS_DIR)).filter((f) => f.endsWith(".json"));
  const configs: SourceConfig[] = [];

  for (const file of files) {
    const raw = await readFile(path.join(CONFIGS_DIR, file), "utf-8");
    const parsed = SourceConfigSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      throw new Error(
        `Invalid source config in ${file}: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
      );
    }
    configs.push(parsed.data);
  }

  cache = configs;
  return configs;
}

export async function getSource(id: string): Promise<SourceConfig | undefined> {
  const configs = await loadAllConfigs();
  return configs.find((c) => c.id === id);
}

export async function listActiveSources(): Promise<SourceConfig[]> {
  const configs = await loadAllConfigs();
  return configs.filter((c) => c.status === "ACTIVE");
}

export async function listByCountry(country: string): Promise<SourceConfig[]> {
  const configs = await loadAllConfigs();
  return configs.filter((c) => c.country === country);
}
