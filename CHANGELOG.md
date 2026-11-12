# Changelog

## Unreleased: UI remodel (`feat/ui-remodel`)

The student UI rebuilt to docs/ui-remodel.md.

- **Home** is a discovery surface: a billboard of top matches (manual pager, no autoplay), a swipeable featured row on phones, an unlock card for the biggest fixable gap, "Pick up where you left off", and rails for strong matches, closing deadlines, funding, one-requirement-away matches and destinations.
- **Every opportunity has a face:** institution logos (monogram fallback), SVG flags, and covers (cached photo, illustrated scene, or a country tint under data saver).
- **Programme, scholarship and university pages** are single scrolling title pages: night banner with score card, action bar (track, apply, save, compare, share), fact tiles, requirement-by-requirement comparison, funding grouped by how each link is known, next steps synced with the tracked checklist, key dates and provenance.
- **Catalogues:** debounced search, filter chips on the same URL keys, an "I qualify" filter, Posters or List view, and a compare tray with `/compare`.
- **My plan** (`/plan`) merges Saved and Applications; the old URLs redirect. Accepted and rejected applications can be moved back, and tracking seeds a document checklist.
- **Profile:** section anchors, searchable nationality, currency select, and errors shown under each field.
- **Shell:** top bar on every width plus a four-tab bar on phones (no sidebar or drawer), page titles, loading skeletons, and error and not-found pages.
- **Data saver** (cookie, honours `Save-Data`) hides pictures across the app.
- **Media pipeline:** `npm run media:enrich` fetches logos and Commons photos via ROR and Wikidata, with credit and licence, plus a `/credits` page.
- **Admin:** current tab marked, sentence-case headings, a confirmation before rejecting, media coverage tiles, and role checks in every admin page.
- **Landing and sign-in:** billboard-style hero with a labelled example card, sign-up links that return to the catalogue, a footer without dead links, and a night panel on sign-in.
- **Database:** adds `User.homeLastVisitedAt` and the University media columns.
- **Recovered data** (docs/ui-remodel-data-gaps.md): deadline dates for 1,052 programmes and 34 scholarships, study mode for 11,480 programmes, length for UK courses, and 26 DAAD scholarship amounts, each with how often it is paid. All come from pages and datasets already on disk. `npm run data:backfill` re-applies them; `npm run deadlines:refresh` moves passed annual deadlines on. Adds `Program.studyMode` and `Scholarship.amountPeriod`.
- **EU / non-EU deadlines:** each student sees only the dates for their group, from the nationality on their profile, on cards, Home, My plan, detail pages and the calendar feed.
- **Posters and facts** read "2 years, full-time" and "€992 a month".
- **Brand:** the KickScholar logo pack in the shell, landing, sign-in, error and credits pages, plus favicon, app icons, web manifest and link-preview images.
- **Scholarship records cleaned up:** website pages captured as scholarships ("About us", "Accommodation", "Find a course", a 404 page) are out of the catalogue, matching and links; pages that belong to an award are merged into it. Each curated source now lists its award pages, and the loader skips anything else. MEXT's page gives its seven scholarship types with their monthly amounts and age limits. Generic names ("Scholarships") no longer merge across providers, and awards published on one page no longer merge into each other. An admin's "Reject" now really removes a scholarship from students' view, and the verification page lists removed ones so they can be restored.
- **Media script:** falls back to the site's own icon and the Wikipedia lead image, passes over wide wordmarks, survives dropped connections, and writes its report row by row.
