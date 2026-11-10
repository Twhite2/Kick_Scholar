# UI remodel: recon, mapping and decisions

Companion to [ui-remodel.md](ui-remodel.md). Records what the brief assumed versus what the code is, how the brief's card types map onto the real models, and the defaults taken where the brief's open questions (§4.2) were still unanswered. Data the UI wanted but couldn't find is in [ui-remodel-data-gaps.md](ui-remodel-data-gaps.md).

Branch: `feat/ui-remodel`, cut from `feat/ingestion-extraction-linking` at `bae3ef1`, which already had `main` merged in.

## Stack confirmed

| Brief asked | Found |
| --- | --- |
| Next.js version | 16.3.0, App Router, `next dev --webpack` / `next build --webpack` |
| Tailwind | v4 (`@theme inline` in `app/globals.css`) |
| ORM | Prisma 7.9 with `@prisma/adapter-pg`, client generated to `lib/generated/prisma` |
| Fonts | `Bricolage_Grotesque` and `Atkinson_Hyperlegible_Next` are both exported by `next/font/google`. No upgrade or self-hosting needed |
| Tests | Vitest (unit only). No Playwright, so the brief's e2e and axe runs are not set up (see "Not done") |
| UI primitives | shadcn on Base UI (`@base-ui/react` 1.7): Select, Combobox, Menu, AlertDialog, Tooltip, Tabs |

## Where things live now

| Area | Files |
| --- | --- |
| Tokens and type scale | `app/globals.css` (colour tokens, shadows, radii, `type-*` utilities, `can-hover` variant) |
| Fonts, `lang="en-GB"`, title template | `app/layout.tsx` |
| Shared UI logic (pure, tested) | `lib/ui/` (`monogram`, `country`, `format`, `strength`, `coverage`, `blockers`, `reasons`, `requirements`, `next-steps`, `nav`, `text`), `lib/catalogue/params.ts`, `lib/home/select.ts`, `lib/matching/aggregate.ts`, `lib/matching/project.ts` |
| Card data | `lib/types/cards.ts`, `lib/cards/` (one place that turns rows into poster props) |
| Loaders | `lib/home/get-home-feed.ts`, `lib/detail/shared.ts`, plus each page's own query |
| Components | `components/kick/` (identity, rails, cards, detail panels, browse controls, shell, plan) |
| Dev kit | `/dev/kit` (`app/(dev)/dev/kit/page.tsx`, 404 in production), fixtures in `fixtures/home-feed.sample.ts` |
| Media pipeline | `lib/media/` (store, processing, sources), `scripts/enrich-institution-media.ts` (`npm run media:enrich`) |

Retired: sidebar and drawer (`components/layout`), dashboard widgets (`components/dashboard`, `lib/dashboard`), old cards and filter panels, the unused `Pager`, the photo slider on sign-in.

## Field mapping (§10.2)

| Brief field | Source |
| --- | --- |
| `InstitutionFace.countryCode`, `city` | `University.country` (ISO 3166-1 alpha-2), `University.city` |
| `InstitutionFace.logoUrl`, `cover` | New `University` media columns (migration `20261110120100_university_media`). Only site-relative or `NEXT_PUBLIC_MEDIA_BASE_URL` URLs are shown (no hotlinking) |
| `InstitutionFace.acronym` | New `University.acronym`, filled from ROR by the media script |
| `MatchInfo.score`, `strength` | `Match.score`, `Match.matchStrength` (stored by the engine; thresholds untouched) |
| `MatchInfo.verified` | `Program.verified` / `Scholarship.verified` |
| `ProgrammeCardData.tuition` | `Program.tuitionType`, `tuitionAmount`, `tuitionCurrency`, `tuitionPeriod` |
| `bestFunding` | No tuition fees, else an officially linked (`EXPLICIT_SOURCE`) scholarship covering tuition, else the tuition amount |
| `nextDeadline` | First `ApplicationDeadline.date` on or after today (Africa/Lagos) |
| `reasons` | Built from `Match.factorScores` by `lib/ui/reasons.ts`: the two heaviest factors scoring 80 or more, then the first blocker |
| `basis` ("7 of 8 checks met") | Factor scores: assessed factors versus those scoring 80 or more (the engine's own "strength" threshold in `explain.ts`) |
| `ScholarshipCardData.coverage`, `amount` | `Scholarship.coverageType`, `amount`, `amountCurrency` |
| `provider.institution` | Only when a scholarship has exactly one officially linked `OFFICIAL_UNIVERSITY_SCHOLARSHIP` university |
| `HomeFeed.previousVisitAt` | New `User.homeLastVisitedAt` (migration `20261110120000_home_last_visited`), written by a client effect after render |
| "New since" | `Program.createdAt`. The loader creates a programme once and merges later sightings into it, so `createdAt` is stable across re-crawls and no `firstSeenAt` column was needed |
| Projected score | `projectScore()` re-aggregates the stored factor scores with one factor set to met, using the same `aggregateScore()` the engine now calls (extracted, behaviour unchanged) |

## Defaults taken for the open questions (§4.2)

| # | Question | What I did |
| --- | --- | --- |
| 1 | Base branch | `feat/ingestion-extraction-linking` (current work, already merged with `main`) |
| 2 | Has `FRONTEND.md` changed? | It still listed the unshipped palette. Updated it to the shipped palette plus Night, per decision table §4.1 |
| 3 | Media storage | Local disk only (`MEDIA_STORE=local`, writes `public/media`, gitignored). The S3 driver deliberately refuses to run until storage is chosen |
| 4 | Logo.dev / Brandfetch token | Logo.dev fallback is wired but only runs when `LOGO_DEV_TOKEN` is set. Not set, so not used. Read their terms before enabling |
| 5 | Support email | "Report something wrong" appears only when `NEXT_PUBLIC_SUPPORT_EMAIL` is set. Not set, so hidden |
| 6 | "Saved" column name on the board | Kept "Saved" |
| 7 | Eligibility "Browse all" target | Kept `/scholarships` |

## Where the code differed from the brief

- **Budget blocker.** The brief's taxonomy has "budget below living costs". The engine compares *tuition* with the stated budget (it has no living-cost data), so the unlock card says "{n} programmes charge more than your budget" and links to tuition funding.
- **Field fit.** The brief's template "Your BSc in Computer Science is a direct fit" describes the prior degree. The engine's field factor actually compares the programme's field category with the student's *desired* fields, so the reason reads "STEM fits what you want to study".
- **Language requirement names.** Some sources name a language rather than a test ("English", "German"). Rows then read "English or German", and next steps read "Prepare your proof of English".
- **Grades on other scales.** A bare threshold such as "Needs a CGPA of 2.5" is wrong on the German scale (lower is better), so grade gaps are worded without the number.
- **Rejected applications.** Moving back from Rejected restores Submitted if the application was ever submitted, otherwise Planning. The schema keeps no status history.
- **Old tab URLs.** The old detail-page tabs were client state, not URL parameters, so there was nothing to redirect. Anchors `#overview`, `#requirements`, `#why`, `#funding`, `#application` exist on the new pages.
- **`/dev/kit`.** The brief names both `app/(dev)/kit` and `/dev/kit`. Built at `app/(dev)/dev/kit` so the URL is `/dev/kit`.
- **Admin role checks.** With the new loading boundary on the signed-in area, a layout's `redirect()` no longer stops its page from rendering. Admin pages therefore call `requireAdmin()` themselves (`lib/auth-guards.ts`). Verified with a student session against a production build: no admin data in the response.

## Applied to your local database

`prisma migrate deploy` applied the two migrations that came from `main` and had never been run locally (`independent_citation_verification`, `credit_requirements_not_gpa`), plus the two new ones. Those `main` migrations delete fabricated and duplicate citations and revoke some cross-reference verifications, as their authors intended. Re-run matching (`npm run match:run -- <userId>`) for accounts whose matches predate them.

## Not done, and why

- **Media pipeline not run.** It needs `MEDIA_BOT_CONTACT` (Wikimedia's User-Agent policy requires real contact details) and a storage decision. Logos are monograms and covers are scenes until then. Suggested first run: `MEDIA_BOT_CONTACT=you@example.com npm run media:enrich -- --country DE,FI,SE,FR,NL,DK,NO,BE,IE,GB --limit 50`, then review `tmp/media-report-*.csv`.
- **Playwright, axe and Lighthouse runs.** Playwright isn't in the project, and the brief says to ask before adding it. Accessibility was handled in code (labels, focus outline, 44px targets, live regions, semantic tables and lists), and screenshots were checked at 390 and 1440 wide. A real axe and Lighthouse pass is still owed.
- **Brief items marked MAY and skipped:** the list-view preview pane, the sticky in-page section bar on detail pages, and the light variant of the top bar after scrolling past a banner.
- **`docs/ui-remodel/home-reference.png`** was not in the repo, so Home was built from the written spec.
