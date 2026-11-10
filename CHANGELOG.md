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
