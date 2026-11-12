# KickScholar

Matches students to study programmes and scholarships using data crawled from
official sources. Every fact in the product carries its source, authority
level and verification status, so a scholarship found on an aggregator is never
presented as if it came from the official page.

**Stack:** Next.js 16 (App Router) · Prisma 7 on PostgreSQL (`pg_trgm`) ·
Auth.js v5 (credentials) · Python Crawl4AI crawler · OpenAI for optional
extraction enrichment · Vitest.

## Setup

Requirements: Node 20+, PostgreSQL 15+, Python 3.11+ (only for crawling).

```bash
npm install
# create .env first (see table below)
npx prisma migrate deploy   # apply migrations
npx prisma generate         # client goes to lib/generated/prisma (gitignored)
npx prisma db seed          # optional sample data
npm run dev
```

`.env`:

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string |
| `AUTH_SECRET` | yes | Auth.js session signing (`npx auth secret` generates one) |
| `OPENAI_API_KEY` | only for `--llm` | Extraction enrichment |
| `EXTRACTION_MODEL` | no | Defaults to `gpt-4o-mini` |
| `KICKSCHOLAR_PYTHON` | no | Python interpreter for the crawler; defaults to `crawler/.venv` |

Crawler (only needed to fetch new pages):

```bash
python -m venv crawler/.venv
crawler/.venv/bin/pip install -r crawler/requirements.txt
crawler/.venv/bin/playwright install chromium
```

To make yourself an admin, set `role = 'ADMIN'` on your `User` row.

## Data pipeline

Run in this order. Each step is a CLI script; most accept `--dry-run`.

| Step | Command | What it does |
| --- | --- | --- |
| 1 | `npm run sources:sync` | Loads `data/sources/configs/*.json` into `Source` rows |
| 2 | `npm run crawl -- <source-id> [maxPages] [--resume]` | Crawls a source into `data/raw/` (gitignored) |
| 3 | `npm run extract -- --source-id <id> [--from-disk] [--llm] [--max-usd N]` | Parses pages into `data/extracted/<source>/*.json` (committed) |
| 4 | `npm run ingest:ror -- [--countries DE,FI]` | Imports universities from the ROR registry |
| 5 | `npm run pipeline:load -- data/extracted/<source>` | Loads extraction files into the database |
| 6 | `npm run link:build` | Links scholarships to institutions (`EXPLICIT_SOURCE` vs `RULE_INFERENCE`) |
| 7 | `npm run match:run -- <userId>` | Recomputes one student's matches (also runs on profile save) |
| 8 | `npm run data:backfill -- [--dry-run] [--verbose]` | Re-reads crawled pages and the Discover Uni release (an `on_*` folder) for deadline dates, study mode, UK course length and DAAD scholarship amounts; patches extraction files and the database |
| 8b | `npm run data:cleanup-scholarships -- [--dry-run]` | Takes website pages captured as scholarships ("About us", "Find a course") out of the catalogue, merging those that belong to an award; reversible from the admin verification page |
| 8c | `npm run data:erasmus-mundus -- [--dry-run]` | Erasmus Mundus joint master's as programmes at their coordinator, with the scholarship explicitly linked to every partner institution. Reads the Commission's Key Action 1 project lists (CSV, 2021 onwards) from `data/erasmus-plus/`, downloaded in a browser from erasmus-plus.ec.europa.eu/projects/projects-lists |
| 8d | `npm run links:hosts` | Explicit links from an award to the institution its page says hosts it ("Hosted by the London School of Economics") |
| 9 | `npm run deadlines:refresh` | Moves passed annual deadlines to their next occurrence (run monthly) |
| 10 | `npm run media:enrich -- --with-programmes --only-missing` | Logos and campus photos from ROR, Wikidata, Commons and the institutions' own sites (needs `MEDIA_BOT_CONTACT`); `--recheck-wide-logos` re-checks stored logos |

Re-running any step is safe: records are dedupe-matched, citations are unique
per (record, source), and inferred links and matches are replaced, not
appended.

## Verification rules

- A record from a **PRIMARY** source (the official page) is verified on insert.
- A **SECONDARY** or **DISCOVERY** record becomes verified only when a
  *different* PRIMARY/SECONDARY source publishes the same record
  (`lib/verification/crossReferenceCheck.ts`), or an admin confirms it.
- A discovery post merely linking to an official page does not count.
- Admin decisions are never overwritten by the pipeline.

## Layout

```
app/(app)        signed-in product: dashboard, programs, scholarships, applications, admin
app/(auth)       login / signup
lib/crawler      Node side of the crawl (spawns crawler/run_crawl.py)
lib/extraction   parsers + LLM enrichment → ExtractionFile JSON
lib/pipeline     loads extraction files into the database
lib/linking      scholarship → institution links
lib/matching     scoring engine (pure; see scoreTarget.ts)
lib/verification cross-source verification
prisma/          schema and migrations (some constraints are raw SQL)
```

## Checks

```bash
npm test
npx next typegen && npx tsc --noEmit   # typegen creates the PageProps route types
npm run lint
```
