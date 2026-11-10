# UI remodel: data gaps

Things the new UI is built to show but the data doesn't have yet. Each element is hidden or says "not published yet" rather than inventing a value (ui-remodel §3). Counts are from the local database on 10 Nov 2026.

| Gap | Effect in the UI | What would close it |
| --- | --- | --- |
| **No deadline has a date.** 0 of 1,334 `ApplicationDeadline` rows have `date`; all are `dateText`, mostly extraction fragments ("The following is valid for applicants from: all countries") | The "Closing soon" rail never appears. Posters show no countdown. The billboard says "Deadline not published yet". Fact tiles and the calendar feed have nothing to show. Key dates shows only text notes that mention a month or "rolling" | Parse dates during extraction (DAAD pages state them in prose) |
| **No scholarship has an amount.** 0 of 434 have `amount` | Funding posters say "To be confirmed" (or "100%" for full tuition) | Extract amount and currency |
| **Amount period not stored** (a month, a year, once) | No "a month, plus tuition" line under amounts | Add a period field to scholarships |
| **Study mode not stored** (full-time or part-time) | Durations read "2 years", not "2 years, full-time" | Add study mode to programmes |
| **Credits not stored.** `Program.creditSystem` is empty everywhere | No credits note on the Length tile | Extract ECTS credits |
| **Tuition mostly unknown.** 10,852 of 12,111 programmes are `UNKNOWN` | Tuition shows "Not yet published"; posters show no funding fact | Extract fees |
| **Intakes mostly empty.** 10,694 programmes | No "Starts" tile | Extract intakes |
| **No logos or covers yet.** 0 of 4,181 institutions | Monograms and illustrated scenes everywhere | Run `npm run media:enrich` (needs `MEDIA_BOT_CONTACT`) |
| **No document requirement type** | Checklists and next steps are derived from requirement types: language test → result, grade → transcripts, work experience → CV, portfolio → portfolio | A `DOCUMENT` requirement type, or a documents list per programme |
| **Results and decision dates not stored** | Never shown, as the brief requires | Extract decision dates |
| **"Degree taught in English" letters** | The billboard never adds ", or a letter showing your degree was taught in English", because no requirement says letters are accepted | Capture that alternative during extraction |
| **No previous Home visit for existing accounts** | The "{n} new since Friday" pill appears from a student's second visit after this release | None needed |
| **Nationality spellings** | The picker stores English names from `Intl` ("Gambia"). Some sources write others ("The Gambia"), and the matcher compares exact names, so a few rules won't match | Normalise source nationality lists to ISO codes (a matching change, out of the UI's scope) |
| **Budget versus living costs** | The engine compares tuition with budget, so the unlock card offers tuition funding, not living-cost funding | Living-cost data per country |
| **No document upload** | "Upload a letter" is hidden on the unlock card | An upload feature |
| **No notifications** | The bell is hidden | A notifications feature |
