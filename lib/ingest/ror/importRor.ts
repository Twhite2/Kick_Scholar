import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "../../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { RorApiResponseSchema, type RorRecord } from "./rorSchema";
import {
  isHigherEducation,
  mapRorToUniversity,
  FALLBACK_HIGHER_ED_CLASSES,
  type MappedUniversity,
} from "./mapRorToUniversity";
import { fetchP31Classes, fetchHigherEdClassClosure } from "./wikidataVetting";
import { matchUniversityCandidates } from "../../deduplication/matchCandidates";
import { shouldOverwriteScalar } from "../../deduplication/mergeRecords";
import { TARGET_COUNTRIES } from "../../constants/countries";
import { isCliEntrypoint } from "../../cliEntrypoint";

const ROR_API = "https://api.ror.org/v2/organizations";
const ROR_SOURCE_ID = "src-ror";
/** ROR asks for <=2000 requests / 5 min per IP; this is far under that. */
const REQUEST_DELAY_MS = 350;

export interface RorImportResult {
  countriesRequested: string[];
  recordsFetched: number;
  mappedOk: number;
  skippedByMapping: Record<string, number>;
  vettedHigherEd: number;
  /** Size of the Wikidata higher-ed class set actually used. */
  higherEdClassCount: number;
  rejectedNoWikidata: number;
  rejectedNotHigherEd: number;
  created: number;
  /** Same ROR record encountered twice (an institution can match more than
   *  one country query); deduped by rorId, not a real merge. */
  duplicateRorRecords: number;
  /** Genuinely merged onto a university another source had already created. */
  mergedOntoExisting: number;
  wikidataFailures: string[];
  /** Names excluded by vetting, for human review — never silently dropped. */
  quarantined: Array<{ rorId: string; name: string; country: string; reason: string }>;
}

async function fetchCountry(
  country: string,
  fetchImpl: typeof fetch,
): Promise<RorRecord[]> {
  const records: RorRecord[] = [];
  let page = 1;
  for (;;) {
    const url =
      `${ROR_API}?filter=types:education,status:active,` +
      `locations.geonames_details.country_code:${country}&page=${page}`;
    const res = await fetchImpl(url, {
      headers: {
        "User-Agent":
          "KickScholarBot/0.1 (+https://kickscholar.example; educational-data-research)",
      },
    });
    if (!res.ok) throw new Error(`ROR ${country} page ${page}: HTTP ${res.status}`);
    const parsed = RorApiResponseSchema.parse(await res.json());
    records.push(...parsed.items);

    // The v2 API caps retrievable results at 10,000; per-country slices are
    // far below that, which is exactly why this pages by country rather than
    // pulling a global list.
    if (records.length >= parsed.number_of_results || parsed.items.length === 0) break;
    page += 1;
    await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS));
  }
  return records;
}

export async function importRor(
  prisma: PrismaClient,
  opts: {
    countries?: string[];
    limit?: number;
    dryRun?: boolean;
    skipVetting?: boolean;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<RorImportResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const countries = opts.countries?.length
    ? opts.countries.map((c) => c.toUpperCase())
    : Object.keys(TARGET_COUNTRIES);

  const result: RorImportResult = {
    countriesRequested: countries,
    recordsFetched: 0,
    mappedOk: 0,
    skippedByMapping: {},
    vettedHigherEd: 0,
    higherEdClassCount: 0,
    rejectedNoWikidata: 0,
    rejectedNotHigherEd: 0,
    created: 0,
    duplicateRorRecords: 0,
    mergedOntoExisting: 0,
    wikidataFailures: [],
    quarantined: [],
  };

  // 1. Fetch + map.
  const mapped: MappedUniversity[] = [];
  for (const country of countries) {
    const records = await fetchCountry(country, fetchImpl);
    result.recordsFetched += records.length;
    for (const record of records) {
      const m = mapRorToUniversity(record);
      if (!m.ok) {
        result.skippedByMapping[m.reason] = (result.skippedByMapping[m.reason] ?? 0) + 1;
        continue;
      }
      mapped.push(m.university);
    }
    await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS));
  }
  result.mappedOk = mapped.length;

  // 2. Vet against Wikidata — ROR "education" alone includes schools and
  //    research institutes, so it is not a university filter.
  let accepted = mapped;
  if (!opts.skipVetting) {
    // Derive the accepted class set from Wikidata's own subclass hierarchy.
    // A hand-curated list measurably under-accepts (see
    // FALLBACK_HIGHER_ED_CLASSES), so that is only the offline fallback.
    const closure = await fetchHigherEdClassClosure({ fetchImpl });
    if (closure) {
      result.higherEdClassCount = closure.size;
    } else {
      result.higherEdClassCount = FALLBACK_HIGHER_ED_CLASSES.size;
      result.wikidataFailures.push(
        "could not fetch the higher-ed subclass closure; fell back to the curated list, which under-accepts",
      );
    }

    const qids = mapped.map((m) => m.wikidataId).filter((q): q is string => Boolean(q));
    const { p31ByQid, failures } = await fetchP31Classes(qids, { fetchImpl });
    result.wikidataFailures.push(...failures);

    accepted = [];
    for (const uni of mapped) {
      if (!uni.wikidataId) {
        result.rejectedNoWikidata += 1;
        result.quarantined.push({
          rorId: uni.rorId,
          name: uni.name,
          country: uni.country,
          reason: "no wikidata id in ROR record",
        });
        continue;
      }
      const classes = p31ByQid.get(uni.wikidataId);
      if (!classes || !isHigherEducation(classes, closure ?? FALLBACK_HIGHER_ED_CLASSES)) {
        result.rejectedNotHigherEd += 1;
        result.quarantined.push({
          rorId: uni.rorId,
          name: uni.name,
          country: uni.country,
          reason: `wikidata P31 has no higher-ed class (${(classes ?? []).join(",") || "none"})`,
        });
        continue;
      }
      accepted.push(uni);
    }
  }
  result.vettedHigherEd = accepted.length;

  if (opts.limit) accepted = accepted.slice(0, opts.limit);
  if (opts.dryRun) return result;

  // 3. Upsert. rorId is the idempotency key; dedupe still runs so an ROR
  //    record merges onto a university a PRIMARY source already created.
  for (const uni of accepted) {
    const existingByRor = await prisma.university.findUnique({ where: { rorId: uni.rorId } });
    if (existingByRor) {
      result.duplicateRorRecords += 1;
      continue;
    }

    const candidates = await matchUniversityCandidates(prisma, {
      dedupeKey: uni.dedupeKey,
      name: uni.name,
      country: uni.country,
      // Prevents this record fuzzy-merging onto a different ROR institution
      // whose name merely looks similar (see matchUniversityCandidates).
      rorId: uni.rorId,
    });

    if (candidates.length > 0) {
      const existing = await prisma.university.findUniqueOrThrow({
        where: { id: candidates[0].id },
      });
      // ROR is SECONDARY: authoritative for organisational identity, but a
      // university's own site (PRIMARY) outranks it on every scalar.
      await prisma.university.update({
        where: { id: existing.id },
        data: {
          rorId: uni.rorId,
          externalIds: uni.externalIds,
          ...(shouldOverwriteScalar(existing.region, existing.authorityLevel, "SECONDARY")
            ? { region: uni.region }
            : {}),
          ...(shouldOverwriteScalar(existing.foundedYear, existing.authorityLevel, "SECONDARY")
            ? { foundedYear: uni.foundedYear }
            : {}),
        },
      });
      await prisma.sourceCitation.create({
        data: {
          sourceableType: "UNIVERSITY",
          sourceableId: existing.id,
          sourceId: ROR_SOURCE_ID,
          role: "CORROBORATING",
        },
      });
      result.mergedOntoExisting += 1;
      continue;
    }

    await prisma.university.create({
      data: {
        name: uni.name,
        dedupeKey: uni.dedupeKey,
        country: uni.country,
        city: uni.city,
        region: uni.region,
        website: uni.website,
        foundedYear: uni.foundedYear,
        rorId: uni.rorId,
        externalIds: uni.externalIds,
        accreditation: [],
        primarySourceId: ROR_SOURCE_ID,
        sourceUrl: uni.sourceUrl,
        authorityLevel: "SECONDARY",
        confidence: 0.9,
        // SECONDARY authority does not self-verify: a registry entry alone is
        // identity evidence, not corroboration.
        verified: false,
        verificationStatus: "UNVERIFIED",
      },
    });
    result.created += 1;
  }

  return result;
}

async function runAsCli() {
  const args = process.argv.slice(2);
  const flag = (n: string) => {
    const i = args.indexOf(`--${n}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const countries = flag("countries")?.split(",").map((c) => c.trim()).filter(Boolean);
  const limit = flag("limit");
  const report = flag("report");
  const dryRun = args.includes("--dry-run");
  const skipVetting = args.includes("--skip-vetting");

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });
  try {
    const r = await importRor(prisma, {
      countries,
      limit: limit ? Number(limit) : undefined,
      dryRun,
      skipVetting,
    });

    console.log(`\n${dryRun ? "[dry run] " : ""}ROR import (${r.countriesRequested.join(", ")})`);
    console.log(`  records fetched from ROR   ${r.recordsFetched}`);
    console.log(`  mapped to University shape ${r.mappedOk}`);
    for (const [reason, n] of Object.entries(r.skippedByMapping)) {
      console.log(`      skipped (${reason})`.padEnd(30) + n);
    }
    console.log(`  vetted as higher education ${r.vettedHigherEd}`);
    console.log(`      rejected: no wikidata  ${r.rejectedNoWikidata}`);
    console.log(`      rejected: not higher-ed ${r.rejectedNotHigherEd}`);
    console.log(`  created                    ${r.created}`);
    console.log(`  merged onto existing uni   ${r.mergedOntoExisting}`);
    console.log(`  duplicate ROR records      ${r.duplicateRorRecords}`);
    if (r.wikidataFailures.length) {
      console.log(`  wikidata batch failures    ${r.wikidataFailures.length}`);
    }

    if (report && r.quarantined.length) {
      const outPath = path.resolve(report);
      await mkdir(path.dirname(outPath), { recursive: true });
      await writeFile(outPath, `${JSON.stringify(r.quarantined, null, 2)}\n`, "utf-8");
      console.log(`\n  ${r.quarantined.length} quarantined institution(s) written to ${report}`);
    } else if (r.quarantined.length) {
      console.log(`\n  ${r.quarantined.length} quarantined (pass --report <file> to inspect). Sample:`);
      for (const q of r.quarantined.slice(0, 8)) {
        console.log(`    - [${q.country}] ${q.name}  (${q.reason})`);
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
