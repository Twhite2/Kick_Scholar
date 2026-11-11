# UI remodel: data gaps

Things the new UI is built to show but the data doesn't have yet. Each element is hidden or says "not published yet" rather than inventing a value (ui-remodel §3). Counts are from the local database on 11 Nov 2026.

## Recovered on 11 Nov 2026

Recovered from pages and datasets already on disk; no new crawl was needed. Run `npm run data:backfill` after any re-crawl or import, and `npm run deadlines:refresh` monthly. Every value comes from the source's own wording. Anything ambiguous is left out.

| Fact | Before | Now | Where it came from |
| --- | --- | --- | --- |
| Deadline dates | 0 of 1,334 rows dated | 1,805 of 1,997 dated; 1,052 programmes and 34 scholarships have a future deadline | DAAD "Application periods" blocks (the old parser kept only their first line) and DAAD scholarship deadline wording |
| EU / non-EU deadlines | Not distinguished | Stored in the intake label ("Winter semester (non-EU applicants)"); each student sees only their group's dates, from the profile's nationality | Same DAAD blocks |
| Scholarship amounts | 0 of 434 | 26, each with its period (`amountPeriod`: a month, a year, one-off, in total) | DAAD "Value" sections |
| Study mode | Not stored | 11,480 of 12,111 programmes (`Program.studyMode`) | DAAD "Full-time / part-time" field; Discover Uni `KISMODE` |
| Programme length | 1,417 of 12,111 | 11,587 of 12,111 | Discover Uni `NUMSTAGE` for full-time UK courses |

What was deliberately left out:

- **Amounts quoted in tiers** ("1,300 EUR for graduates, 1,600 EUR for post-docs", "£1,347 a month, £1,652 in London", "Master's: 9.500 TL, PhD: 12.500 TL"). No single figure is true for every recipient, so the poster keeps "To be confirmed".
- **Amounts on Chevening, Commonwealth, MEXT and Türkiye Burslari pages.** These sources were crawled as whole site pages (overviews, fee and rent tables, lists of several programmes), so a figure on the page is rarely the amount of the record built from it. Many of those records are not scholarships at all; see the last row of the table below.
- **Dates that are not deadlines:** application openings ("from 3 February", "between 4 November and …"), programme and funding starts, admission dates, and funding periods.
- **295 UK courses** whose URL and title are shared by two courses with different lengths or modes.

## Still open

| Gap | Effect in the UI | What would close it |
| --- | --- | --- |
| **Undated deadlines.** 192 rows are text only ("check the website", "no deadline listed"); 217 DAAD programme pages give no date | Key dates shows the source's wording; no countdown | The universities' own pages |
| **Most scholarships have no amount** (408 of 434) | Funding posters say "To be confirmed" (or "100%" for full tuition) | A per-programme crawl of tiered and non-DAAD scholarships, or the LLM pass with the tier rule above |
| **Credits not stored.** `Program.creditSystem` is empty everywhere | No credits note on the Length tile | Extract ECTS credits |
| **Tuition mostly unknown.** 10,852 of 12,111 programmes are `UNKNOWN` | Tuition shows "Not yet published"; posters show no funding fact | Extract fees (UK fees are per fee regime and year in Discover Uni) |
| **Intakes mostly empty.** 10,694 programmes | No "Starts" tile | Extract intakes |
| **Logos and covers incomplete.** Of the 298 institutions with programmes, 155 have a logo and 164 a photo (703 logos and 703 photos across all 4,181) | Monograms and illustrated scenes where none was found. Wide wordmarks (wider than 2.6:1) are passed over, because the monogram reads better at tile size: 158 were cleared and 127 replaced by the site's square icon | `npm run media:enrich` (needs `MEDIA_BOT_CONTACT`); `-- --recheck-wide-logos` re-checks stored logos |
| **Page-level "scholarships"** from Chevening (13), Commonwealth (25), MEXT (9) and Türkiye Burslari (28) | Records such as "Find a course", "About us", "Accommodation" and "Who can apply for a Chevening Fellowship?" appear as scholarships, some near the top of the list | Review and remove or merge them; extract one record per real award |
| **No document requirement type** | Checklists and next steps are derived from requirement types: language test → result, grade → transcripts, work experience → CV, portfolio → portfolio | A `DOCUMENT` requirement type, or a documents list per programme |
| **Results and decision dates not stored** | Never shown, as the brief requires | Extract decision dates |
| **"Degree taught in English" letters** | The billboard never adds ", or a letter showing your degree was taught in English", because no requirement says letters are accepted | Capture that alternative during extraction |
| **No previous Home visit for existing accounts** | The "{n} new since Friday" pill appears from a student's second visit after this release | None needed |
| **Nationality spellings** | The picker stores English names from `Intl` ("Gambia"). Some sources write others ("The Gambia"), and the matcher compares exact names, so a few rules won't match | Normalise source nationality lists to ISO codes (a matching change, out of the UI's scope) |
| **Budget versus living costs** | The engine compares tuition with budget, so the unlock card offers tuition funding, not living-cost funding | Living-cost data per country |
| **No document upload** | "Upload a letter" is hidden on the unlock card | An upload feature |
| **No notifications** | The bell is hidden | A notifications feature |
