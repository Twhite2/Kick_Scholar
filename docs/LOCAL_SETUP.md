# Local setup

There is **no shared development database**. Every developer runs their own
local Postgres. The `DATABASE_URL` in anyone's `.env` is specific to their
machine and will not work on yours.

## 1. Environment

```bash
cp .env.example .env
```

Fill in your own `DATABASE_URL` and generate your own `AUTH_SECRET` with
`npx auth secret`. You do **not** need an `OPENAI_API_KEY` unless you intend to
re-run extraction; everything else works without one.

Use `127.0.0.1` rather than `localhost` in the URL. On Windows, `localhost`
resolves to `::1` first, and a Postgres listening on IPv4 refuses that
connection while still looking healthy to anything that falls back.

## 2. Database

Create an empty database called `kickscholar`, then:

```bash
npx prisma migrate deploy
npx prisma generate
```

## 3. Data: pick one route

### Fast — restore the catalogue dump

Ask for `kickscholar-catalogue.sql.gz` (about 4.6 MB). It carries universities,
programmes, scholarships, eligibility rules, requirements and the computed
funding links, and **deliberately contains no user accounts, profiles or
matches**.

```bash
gunzip -c kickscholar-catalogue.sql.gz | psql -d kickscholar
```

The dump is data-only, so run the migrations first.

### Reproducible — rebuild from the repo

Slower, but needs nothing passed between machines, because every extraction
file is committed. This is the route to use if you want to verify the pipeline
rather than just get a populated database.

```bash
npm run db:bootstrap
```

That runs, in order: migrations, source registry sync, the ROR university
import (a few hundred API calls, no key required), loading the committed
extraction files for all three sources, and the link builder.

Expect it to take a while. The ROR import is network-bound and the loader
processes roughly 3,500 files.

## 4. Run it

```bash
npm run dev
```

Sign up through the UI to create an account, fill in the profile, and matches
compute automatically on save. To recompute later:

```bash
npm run match:run -- <userId>
```

## Windows and WSL

If you run Postgres inside WSL, the VM sleeps aggressively and takes the
database with it, which surfaces as `ECONNREFUSED` or as a misleading
"Invalid email or password" at sign-in. Three helpers exist:

| Command | What it does |
|---|---|
| `npm run db:up` | Wakes WSL and confirms Postgres is accepting connections |
| `npm run db:keepalive` | Holds the VM awake while the terminal stays open |
| `npm run db:task:install` | Installs a background task that keeps it awake permanently |

See the comments in `scripts/install-db-task.ps1` for the measurements behind
this and the several approaches that did not work.
