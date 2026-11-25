# VarsityFind

Formerly KickScholar. The repository (`Kick_Scholar`) and the local database
(`kickscholar`) keep the old name; everything students see says VarsityFind.

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
| `VARSITYFIND_PYTHON` | no | Python interpreter for the crawler; defaults to `crawler/.venv` (the old name, `KICKSCHOLAR_PYTHON`, still works) |
| `SIGNUP_MODE` | no | `invite` closes sign-up and shows the waitlist instead; unset or `open` keeps it open |

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
| 8e | `npm run data:register -- --country NL|AU|FR [--add-institutions]` | Master's and doctoral programmes from a national register: the Netherlands (DUO, CC BY), Australia (CRICOS, CC BY 2.5 AU), France (Mon Master, Licence Ouverte). Files go in `data/registers/<country>/`; see the script's header for each download. Institutions match by website, name or ROR's affiliation matcher; `--add-institutions` adds ones ROR knows but the catalogue lacks |
| 8d | `npm run links:hosts` | Explicit links from an award to the institution its page says hosts it ("Hosted by the London School of Economics") |
| 9 | `npm run deadlines:refresh` | Moves passed annual deadlines to their next occurrence (run monthly) |
| 10 | `npm run media:enrich -- --with-programmes --only-missing` | Logos and campus photos from ROR, Wikidata, Commons and the institutions' own sites (needs `MEDIA_BOT_CONTACT`); `--recheck-wide-logos` re-checks stored logos |

Re-running any step is safe: records are dedupe-matched, citations are unique
per (record, source), and inferred links and matches are replaced, not
appended.

## Waitlist

With `SIGNUP_MODE=invite`, `/signup` (where every "Sign up" link points) shows
the waitlist instead: email, target degree, up to three destination countries
and an optional nationality. `/waitlist` is the same form at a shareable
address. Existing users log in as usual.

- **Inviting:** Admin → Waitlist invites the longest-waiting students, filtered
  by degree and country, or one person at a time. Each invite is a personal
  `/signup?invite=…` link that works for 30 days and only for that email, and
  each is emailed to its student ("Your VarsityFind invite is here"). The page
  marks each invite **Emailed** or **Not emailed**, and shows the links once
  (only a hash is stored), so any that didn't go out can be sent by hand.
  "New link" emails a fresh link; the old one stops working.
- **Joining:** the account is created for the invited email, the entry is
  marked joined, and the profile form starts from the waitlist answers.
  Anyone on the list who signs up while sign-up is open is marked joined too.
- **Abuse:** the form gives the same reply for new, repeated and
  already-registered emails, never edits an existing entry, has a honeypot
  field, and allows 5 entries an hour per network (keyed HMAC of the IP).
- **Privacy:** "Delete" removes an entry for good.
- The landing page is prerendered, so its sign-up wording follows the
  `SIGNUP_MODE` set at build time.

## Email

New waitlist entries get a "You're on the list" email, invited students
their personal link ("Your VarsityFind invite is here"), and new accounts a
welcome email. All come from `info@varsityfind.com` in the site's design
(`lib/email/templates.ts`). The confirmation and welcome go out after the
page has responded, so a slow or failed email never holds up or breaks
signing up; invites are sent while the admin waits, so the page can say
which went out. Mailjet's free plan allows a limited number of emails a
day, so invite large batches over several days.

- **Sending:** Mailjet's Send API over HTTPS (`lib/email/send.ts`), because
  Render's free plan blocks SMTP. Set `MAILJET_API_KEY`, `MAILJET_SECRET_KEY`
  and `EMAIL_FROM`. Without the keys, emails are logged instead of sent.
- **Who gets one:** only a genuinely new waitlist entry. Someone re-entering
  an email, or with an account already, sees the same reply on screen but
  gets no email, so the form can't spam an inbox or reveal who has signed up.
- **Preview:** `npm run email:preview` writes both emails to
  `tmp/email-preview/`, to open in a browser.

## Hosting on Render

`render.yaml` is a Render Blueprint for the web app and its Postgres database,
both in Frankfurt. In Render: **New → Blueprint**, pick this repository, enter
`NEXT_PUBLIC_SITE_URL` when asked, then **Apply**. Each deploy builds `main`,
runs `prisma migrate deploy`, and starts with sign-up invite-only.

The new database starts empty. To fill it, take the database's **External
Database URL** from Render and run, from a machine with the catalogue:

```bash
# Catalogue only: no user accounts, profiles, matches or waitlist entries
pg_dump -d kickscholar --data-only --no-owner --no-privileges \
  -t '"Source"' -t '"CrawlJob"' -t '"SourceDocument"' -t '"SourceCitation"' \
  -t '"University"' -t '"Program"' -t '"ProgramRequirement"' -t '"Scholarship"' \
  -t '"ScholarshipEligibility"' -t '"FundingOpportunity"' -t '"ApplicationDeadline"' \
  | psql "$RENDER_EXTERNAL_URL"

# The media files aren't hosted yet (see below)
psql "$RENDER_EXTERNAL_URL" -c 'UPDATE "University" SET "logoUrl" = NULL, "logoSource" = NULL, "logoCheckedAt" = NULL,
  "coverUrl" = NULL, "coverWidth" = NULL, "coverHeight" = NULL, "coverColor" = NULL, "coverCredit" = NULL,
  "coverLicense" = NULL, "coverLicenseUrl" = NULL, "coverSourceUrl" = NULL, "coverCheckedAt" = NULL'

DATABASE_URL="$RENDER_EXTERNAL_URL" npm run admin:create -- --email findvarsity@gmail.com
```

Logos and photos live in `public/media`, which is not in git, so the hosted
copy clears the universities' media paths. The app then shows monograms and
illustrated covers until the media has a hosted home (`MEDIA_STORE`,
`NEXT_PUBLIC_MEDIA_BASE_URL`).

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
