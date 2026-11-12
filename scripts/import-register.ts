import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { isCliEntrypoint } from "../lib/cliEntrypoint";
import { auProgrammes, frProgrammes, nlProgrammes } from "../lib/ingest/registers/adapters";
import { loadRegister } from "../lib/ingest/registers/loadRegister";
import type { RegisterProgramme, RegisterSource } from "../lib/ingest/registers/types";

/**
 * Master's and doctoral programmes from a country's national register
 * (docs: "Programme data for every institution", Part B).
 *
 *   npm run data:register -- --country NL [--dir data/registers/nl] [--dry-run] [--no-ror] [--add-institutions]
 *
 * Files, downloaded from each register's open-data page into the folder:
 *   NL  ho_erkenningen_rio.csv          DUO, onderwijsdata.duo.nl (Overzicht Erkenningen ho), CC BY
 *   AU  cricos-courses.csv, cricos-institutions.csv
 *                                       data.gov.au (CRICOS), CC BY 2.5 AU
 *   FR  fr-esr-mon_master.csv           data.enseignementsup-recherche.gouv.fr (Mon Master), Licence Ouverte 2.0
 *
 * Programmes are attached only to institutions already in the catalogue
 * (matched by website, name, or ROR's affiliation matcher); the rest are
 * listed so their institutions can be imported from ROR first. With
 * --add-institutions, an institution ROR knows but the catalogue lacks is
 * added from its ROR record: the register's listing is the evidence that it
 * awards degrees, which the ROR import's Wikidata check could not confirm.
 */

interface Register {
  source: RegisterSource;
  files: string[];
  read: (texts: string[]) => RegisterProgramme[];
}

const REGISTERS: Record<string, Register> = {
  NL: {
    source: { sourceId: "src-duo-nl", datasetUrl: "https://onderwijsdata.duo.nl/datasets/overzicht-erkenningen-ho" },
    files: ["ho_erkenningen_rio.csv"],
    read: ([csv]) => nlProgrammes(csv),
  },
  AU: {
    source: { sourceId: "src-cricos-au", datasetUrl: "https://data.gov.au/data/dataset/cricos" },
    files: ["cricos-courses.csv", "cricos-institutions.csv"],
    read: ([courses, institutions]) => auProgrammes(courses, institutions),
  },
  FR: {
    source: { sourceId: "src-monmaster-fr", datasetUrl: "https://data.enseignementsup-recherche.gouv.fr/explore/dataset/fr-esr-mon_master/" },
    files: ["fr-esr-mon_master.csv"],
    read: ([csv]) => frProgrammes(csv),
  },
};

async function main() {
  const argv = process.argv.slice(2);
  const arg = (name: string) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const country = (arg("country") ?? "").toUpperCase();
  const register = REGISTERS[country];
  if (!register) throw new Error(`--country must be one of ${Object.keys(REGISTERS).join(", ")}`);
  const dir = path.resolve(arg("dir") ?? path.join("data", "registers", country.toLowerCase()));
  const missing = register.files.filter((f) => !existsSync(path.join(dir, f)));
  if (missing.length) throw new Error(`Missing in ${dir}: ${missing.join(", ")} (see the header of scripts/import-register.ts for where to download them)`);

  const programmes = register.read(register.files.map((f) => readFileSync(path.join(dir, f), "utf8")));
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  try {
    const dryRun = argv.includes("--dry-run");
    const r = await loadRegister(prisma, register.source, programmes, { dryRun, useRor: !argv.includes("--no-ror"), addInstitutions: argv.includes("--add-institutions") });
    console.log(
      `${dryRun ? "Dry run: nothing written.\n" : ""}  register rows          ${r.rows}\n  programmes             ${r.programmes} at ${r.institutionsMatched} institutions\n  ROR lookups            ${r.rorLookups}` +
        (dryRun ? "" : `\n  loaded                 ${r.created} created, ${r.merged} merged, ${r.failedFiles} files failed`),
    );
    if (r.institutionsAdded.length) console.log(`  institutions added     ${r.institutionsAdded.length} from ROR: ${r.institutionsAdded.slice(0, 8).join(", ")}${r.institutionsAdded.length > 8 ? ", ..." : ""}`);
    if (r.unmatched.length) {
      const total = r.unmatched.reduce((n, u) => n + u.programmes, 0);
      console.log(`  not in the catalogue   ${r.unmatched.length} institutions, ${total} programmes. Largest:`);
      for (const u of r.unmatched.slice(0, 15)) console.log(`    ${String(u.programmes).padStart(4)}  ${u.name}${u.code ? ` (${u.code})` : ""}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

if (isCliEntrypoint(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
