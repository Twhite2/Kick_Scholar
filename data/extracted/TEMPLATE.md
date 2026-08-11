# Extraction file template

Generated from `lib/extraction/schemas.ts` (`ExtractionFileSchema`). One file
per crawled `SourceDocument`, saved to
`data/extracted/<sourceId>/<sourceDocumentId>.json`.

## The rule

**If the source document does not explicitly state a fact, the field is
`null` (or omitted where it defaults to `[]`/`null`) — never inferred, never
guessed, never filled in from general knowledge.** Every requirement,
deadline, and eligibility criterion requires a verbatim `sourceQuote` copied
from the Markdown — if you can't quote it, it doesn't go in.

## Top-level shape

```jsonc
{
  "sourceId": "src-tu-berlin",                 // matches a data/sources/configs/*.json id
  "sourceDocumentId": "src-tu-berlin:<sha256>", // the SourceDocument.id this was extracted from
  "extractedBy": "manual",
  "extractedAt": "2026-08-10T16:20:00Z",
  "universities": [ /* ExtractedUniversity[] */ ],
  "programs": [ /* ExtractedProgram[] */ ],
  "scholarships": [ /* ExtractedScholarship[] */ ]
}
```

Most files populate only one of `universities` / `programs` /
`scholarships` — a university's international-programs page might yield
several `programs` entries; a scholarship aggregator post yields one
`scholarships` entry.

## ExtractedProgram

| Field | Type | Notes |
|---|---|---|
| `universityName`, `universityWebsite` | string, url | |
| `name` | string | |
| `degreeLevel` | enum | `HIGH_SCHOOL｜BACHELOR｜MASTER｜PHD｜DIPLOMA｜CERTIFICATE｜OTHER` |
| `fieldOfStudy` | string | |
| `fieldCategory` | enum | `STEM｜BUSINESS｜HUMANITIES｜SOCIAL_SCIENCES｜ARTS｜HEALTH｜LAW｜EDUCATION｜OTHER` |
| `durationMonths` | number\|null | |
| `instructionLanguages` | string[] | |
| `tuitionType` | enum | `FREE｜PAID｜UNKNOWN｜VARIES` — **never 0 for "unknown"** |
| `tuitionAmount`, `tuitionCurrency`, `tuitionPeriod` | | required together if `tuitionType=PAID`; must be null otherwise |
| `programUrl` | url | |
| `sourceUrl` | url | the page this record's core facts came from |
| `sourceQuote` | string | verbatim justification for the degree-level/identity claim |
| `requirements[]` | `ExtractedRequirement[]` | append-only — one entry per stated requirement |
| `deadlines[]` | `ExtractedDeadline[]` | |

### ExtractedRequirement

`{ requirementType, testName, operator, value, unit, sourceQuote, sourceUrl }`

- `requirementType`: `LANGUAGE_TEST｜MIN_GPA｜DEGREE_PREREQUISITE｜WORK_EXPERIENCE｜STANDARDIZED_TEST｜PORTFOLIO｜INTERVIEW｜OTHER`
- `operator`: `GTE｜LTE｜GT｜LT｜EQ｜IN_LIST｜BOOLEAN_TRUE`
- `sourceUrl` is optional — only set it when this specific fact came from a
  *different* page than the record's own `sourceUrl` (e.g. a shared
  "application deadlines" page); otherwise leave `null` and it's understood
  to be the same page.

### ExtractedDeadline

`{ deadlineType, date, dateText, intake, sourceQuote, sourceUrl }` — exactly
one of `date` (ISO 8601) or `dateText` (e.g. `"rolling admission"`) must be
set. Never fabricate a `date` from a vague `dateText`.

### ExtractedEligibility (scholarships only)

`{ criterionType, operator, valueList, numericValue, textValue, sourceQuote, sourceUrl }`

- `criterionType`: `NATIONALITY｜DEGREE_LEVEL｜FIELD_OF_STUDY｜MIN_GPA｜MAX_AGE｜COUNTRY_OF_STUDY｜UNIVERSITY｜FINANCIAL_NEED｜ACADEMIC_EXCELLENCE｜WORK_EXPERIENCE｜LANGUAGE｜OTHER`

## ExtractedScholarship

Same provenance discipline as programs, plus:
- `discoveredFrom` / `discoveryUrl`: set when this record came from a
  DISCOVERY-authority source (e.g. Bright Scholarship) rather than an
  official page directly.
- `officialSourceUrl`: set once you've found and can cite the scholarship's
  own official page — even if you haven't fully cross-referenced every
  fact against it yet (that's `lib/verification`'s job at load time).

## ExtractedUniversity

`{ name, country (ISO2), city, website, description, sourceUrl, sourceQuote }`
