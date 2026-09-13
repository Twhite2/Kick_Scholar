/**
 * Confirms an institution is genuinely higher-education by reading
 * Wikidata's own P31 ("instance of") classification.
 *
 * This exists because ROR's `types: ["education"]` is not a university
 * filter — verified live, it also returns secondary schools and pure
 * research institutes. Rather than guessing from names (which cannot
 * distinguish "Forschungsinstitut für Kinderernährung" from a university),
 * this defers to a curated external classification.
 *
 * No API key; the endpoint is public and free.
 */

const WIKIDATA_API = "https://www.wikidata.org/w/api.php";
const WIKIDATA_SPARQL = "https://query.wikidata.org/sparql";
/** wbgetentities accepts up to 50 ids per request. */
const BATCH_SIZE = 50;

const USER_AGENT =
  "KickScholarBot/0.1 (+https://kickscholar.example; educational-data-research)";

/**
 * Every Wikidata class that is a `subclass of*` "higher education
 * institution" (Q38723) — ~918 QIDs.
 *
 * Fetched rather than hand-listed because a curated list is provably
 * insufficient: it silently rejected universities of applied sciences,
 * military academies and police academies, keeping only 17 of 49 Finnish
 * institutions. The closure is derived from Wikidata's own ontology, so new
 * institution types are handled without code changes.
 */
export async function fetchHigherEdClassClosure(
  opts: { fetchImpl?: typeof fetch; rootClass?: string } = {},
): Promise<Set<string> | null> {
  const doFetch = opts.fetchImpl ?? fetch;
  const root = opts.rootClass ?? "Q38723";
  const query = `SELECT DISTINCT ?c WHERE { ?c wdt:P279* wd:${root} . }`;
  const url = `${WIKIDATA_SPARQL}?query=${encodeURIComponent(query)}`;

  try {
    const res = await doFetch(url, {
      headers: { Accept: "application/sparql-results+json", "User-Agent": USER_AGENT },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      results?: { bindings?: Array<{ c?: { value?: string } }> };
    };
    const qids = (body.results?.bindings ?? [])
      .map((b) => b.c?.value?.split("/").pop())
      .filter((v): v is string => Boolean(v));
    return qids.length > 0 ? new Set(qids) : null;
  } catch {
    // Caller falls back to the curated list and reports it.
    return null;
  }
}

export interface WikidataClassLookup {
  /** QID -> its P31 "instance of" class QIDs. Absent = not found. */
  p31ByQid: Map<string, string[]>;
  failures: string[];
}

interface WbGetEntitiesResponse {
  entities?: Record<
    string,
    {
      claims?: Record<
        string,
        Array<{
          mainsnak?: { datavalue?: { value?: { id?: string } } };
        }>
      >;
    }
  >;
}

export async function fetchP31Classes(
  qids: readonly string[],
  opts: { fetchImpl?: typeof fetch; delayMs?: number } = {},
): Promise<WikidataClassLookup> {
  const doFetch = opts.fetchImpl ?? fetch;
  const delayMs = opts.delayMs ?? 250;
  const p31ByQid = new Map<string, string[]>();
  const failures: string[] = [];

  const unique = [...new Set(qids)].filter(Boolean);

  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const batch = unique.slice(i, i + BATCH_SIZE);
    const url =
      `${WIKIDATA_API}?action=wbgetentities&ids=${batch.join("|")}` +
      `&props=claims&format=json&origin=*`;

    try {
      const res = await doFetch(url, { headers: { "User-Agent": USER_AGENT } });
      if (!res.ok) {
        failures.push(`batch ${i / BATCH_SIZE}: HTTP ${res.status}`);
        continue;
      }
      const body = (await res.json()) as WbGetEntitiesResponse;
      for (const [qid, entity] of Object.entries(body.entities ?? {})) {
        const classes = (entity.claims?.P31 ?? [])
          .map((c) => c.mainsnak?.datavalue?.value?.id)
          .filter((v): v is string => Boolean(v));
        p31ByQid.set(qid, classes);
      }
    } catch (err) {
      failures.push(`batch ${i / BATCH_SIZE}: ${(err as Error).message}`);
    }

    if (delayMs && i + BATCH_SIZE < unique.length) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return { p31ByQid, failures };
}
