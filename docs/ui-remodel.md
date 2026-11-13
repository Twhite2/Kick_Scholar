# KickScholar UI remodel — implementation brief for Claude Code

Version 1.0 · 10 November 2026 · Owner: Jarvis (VisionJar Labs Ltd)
Applies to: the KickScholar Next.js app, as described in the "User Interface Reference" of 10 Nov 2026 (branch `feat/ingestion-extractionlinking`).

---

## 0. How to use this brief

- Save this file in the repo as `docs/ui-remodel.md`.
- Put a PNG export of the **Home, desktop** artboard from the "KickScholar Redesign" canvas at `docs/ui-remodel/home-reference.png`. It is the visual source of truth for Home. Open it before building any Home component.
- Add one line to `CLAUDE.md`: `UI work follows docs/ui-remodel.md. Work one phase at a time and stop at each gate.`
- Work strictly phase by phase (§16). Each phase ends with a **gate**: run the checks, report, and stop for Jarvis to review. Ready-made prompts are in Appendix D.
- Keywords: **MUST** = required to pass the phase gate. **SHOULD** = do it unless there is a concrete reason not to; write the reason in the PR description. **MAY** = optional polish.
- Precedence: Jarvis's instructions in chat > this brief > habits. If this brief assumes something about the code that turns out to be wrong, follow the code, note the mismatch in `docs/ui-remodel-recon.md`, and adapt the brief's intent.

---

## 1. Goal

Turn KickScholar from a generic dashboard into a product students want to open every week.

- **Home** becomes a personalised, Netflix-style discovery surface: a cinematic "top match" billboard and horizontal rails, each rail with its own card format.
- **Every programme, scholarship and university gets a recognisable face**: logo, country flag, cover image. Programmes look like photo posters; scholarships look like money posters.
- **Decision pages stay data-rich and honest**: why you match, requirement by requirement, with provenance and verification visible.
- **Light on data** for students on mobile data in Nigeria.

This is a UI-first remodel. Matching, scoring, ingestion, crawling, verification and auth logic do not change, apart from the small, explicit data additions in §10 and §11.

---

## 2. The concept in five rules

1. **Rails for discovery, pages for decisions.** Home is a stack of horizontal rails. Programme, scholarship and university pages are long "title pages" that explain the match. Catalogues keep search and filters.
2. **Every opportunity has a face.** Institution logo on a white tile, a flag beside every country name, a cover image (campus photo, else an illustrated scene, else a tinted block). Students should tell a programme from a scholarship before reading a word.
3. **Calm density.** One image per card. At most three facts on a programme poster, two on other cards. One badge per card. Colour carries meaning only: **blue** = discovery and actions, **green** = money and qualification, **red** = deadlines and missing requirements.
4. **Trust stays visible.** "Verified source" vs "Needs verification", "Officially linked" vs "May apply" stay as explicit labels. Unverified data is never shown as Strong match or Likely eligible (strength rules unchanged, §6.4).
5. **Light on data.** Lazy images, small cached logos, AVIF/WebP, a Data saver mode, no autoplay.

Retention loops the UI MUST deliver (data permitting, after Phase 2):

| Loop | Where | What it says |
| --- | --- | --- |
| Pick up where you left off | Home | Applications in progress, nearest deadline first, next document to prepare |
| Unlock card | Home | "23 more programmes open up when you add an English test score" |
| One requirement away | Home rail | Matches that become strong if one gap is closed, with projected score |
| New since last visit | Rail headers | "4 new since Friday" |
| Countdown tickets | Home rail | "12 days left" |

---

## 3. Hard constraints (do not break)

- Do not change matching thresholds, scoring, ingestion, crawl or verification logic. Read their outputs.
- Every route in the signed-in zone MUST still check the session on the server. Admin routes MUST still require role `ADMIN`.
- Keep every existing route path working: `/dashboard`, `/programs`, `/programs/[id]`, `/scholarships`, `/scholarships/[id]`, `/institutions`, `/institutions/[id]`, `/saved`, `/applications`, `/profile`, `/eligibility`, `/admin`, `/admin/sources`, `/admin/crawl-jobs`, `/admin/verification`, `/login`, `/signup`, `/`. New routes are allowed (§7.3). Merged pages keep old paths alive via redirects.
- Keep catalogue URL query keys and meanings: `q`, `country`, `degree`, `field`, `tuition`, `sort`, `coverage`, `verified`, `has`, page number. New keys are additive.
- Strength badge rules (§6.4) are fixed. Reuse the existing helper; do not duplicate thresholds.
- **Do not invent data.** If a field doesn't exist (for example a results date or study mode), hide that element and list it in `docs/ui-remodel-data-gaps.md`. Sample data lives only in fixtures (Appendix C).
- Don't hotlink third-party images in production. Cache them to our storage (§11).
- Accessibility (§13) is part of done, not polish.
- No emoji anywhere in the UI. Flags are SVG (Windows doesn't render flag emoji).
- Keep `prefers-reduced-motion` support.
- Keep existing optimistic save behaviour (instant toggle, revert on failure).

---

## 4. Decisions baked in, and open questions

### 4.1 Decisions

| Topic | Decision | Notes |
| --- | --- | --- |
| Palette | Keep shipped Kick Blue `#0B4F8C`, Kick Green `#2E8B57`, Kick Red `#C62828`. Add **Night** `#071D33` for immersive surfaces | Update `FRONTEND.md` to match (closes the spec-vs-shipped palette gap) |
| Fonts | Bricolage Grotesque (display) + Atkinson Hyperlegible Next (UI text) | JetBrains Mono and Inter retired from the student UI |
| Spelling | British English in UI copy ("Programmes", "colour") | Route paths unchanged (`/programs`) |
| Navigation | Top bar on desktop; 4-tab bottom bar on phones | Sidebar and hamburger drawer removed |
| Theme | Light app with fixed-dark "night" zones (Home billboard, detail banners, top bar on those pages) | Full dark mode out of scope |
| Billboard | Never auto-rotates | Manual pager only |
| Hover previews | Desktop pointer devices only | Touch taps go straight to the page |
| Old dashboard widgets | Retired: hero average score, stat cards, Funding Potential, StudyAbroad Journey, Insights | Their jobs move to: rail counts, "Browse by destination", unlock card, "Closing soon", "One requirement away". Average score stays on `/eligibility` |

### 4.2 Open questions (Claude Code: ask Jarvis, don't guess)

1. Which branch should `feat/ui-remodel` start from?
2. Has `FRONTEND.md` changed since the UI reference? If yes, confirm the palette decision before editing it.
3. Where should media (logos, photos) be stored? (Existing storage, S3-compatible bucket, other?)
4. Is there a Logo.dev or Brandfetch account/token for logo fallback?
5. Support email for "Report something wrong" links (env `NEXT_PUBLIC_SUPPORT_EMAIL`). Hide the link if unset.
6. The applications board's first column is called "Saved", which clashes with the Saved tab. Rename it to "Interested"? (Default: keep "Saved" until answered.)
7. The eligibility report's "Browse all" link currently goes to `/scholarships`. Intended, or should it go to `/programs?sort=best&qualify=1`?

---

## 5. Design tokens

### 5.1 Colour

Add these as CSS variables in `app/globals.css`. Names are chosen not to collide with shadcn tokens (shadcn's `--muted` is a background, so muted *text* is `--ink-3` here).

| Token | Value | Use |
| --- | --- | --- |
| `--night` | `#071D33` | Billboard, detail banners, night top bar, mobile Home header zone |
| `--night-raised` | `#0D2C4A` | Card surfaces on night (mobile featured card body) |
| `--paper` | `#F3F5F8` | Page background |
| `--card` (shadcn) | `#FFFFFF` | Cards, panels |
| `--ink` | `#0E1B2A` | Primary text |
| `--ink-2` | `#2B3A4B` | Secondary text on cards (facts) |
| `--ink-3` | `#546477` | Tertiary text, captions, metadata |
| `--line` | `#E4E9EF` | Hairlines, card outlines |
| `--line-strong` | `#C9D3DE` | Outline buttons, icon buttons, inputs |
| `--track` | `#E5EAF0` | Dial tracks, progress tracks, skeletons |
| `--kick-blue` | `#0B4F8C` | Primary actions, links, active nav, discovery |
| `--kick-blue-hover` | `#083A68` | Hover/pressed for Kick Blue |
| `--blue-tint` | `#E7F0F9` | Pills, icon tiles, secondary buttons |
| `--kick-green` | `#2E8B57` | Icons, dial arcs, bars. **Not for text under 24px** (4.25:1) |
| `--green-text` | `#1F7A4D` | Green text on white or green tint |
| `--green-tint` | `#E6F4EC` | Verified badge background |
| `--kick-red` | `#C62828` | Deadline/missing icons and text on white |
| `--red-text` | `#B3261E` | Red text on red tint (ticket stubs) |
| `--red-deep` | `#8E1F1A` | Body text inside red tint boxes |
| `--red-tint` | `#FDECEC` | Gap boxes, urgent ticket stubs |
| `--grey-tint` | `#EEF1F4` | Neutral badges and pills |
| `--slate` | `#3A4A5E` | Text on grey tint; neutral poster band |
| `--unverified` | `#6B7A8C` | Dial arc for "Needs verification" (non-text only) |
| `--on-night` | `#FFFFFF` | Text on night |
| `--on-night-muted` | `#B8C7D8` | Secondary text and inactive nav on night |
| `--on-night-success` | `#6FD39B` | Met-requirement icons, dial arc on night |
| `--on-night-danger` | `#FF9C94` | Gap icons on night |
| `--on-night-link` | `#9CC8F2` | Links on night |
| `--on-night-line` | `rgba(255,255,255,0.18)` | Dial track and borders on night |
| `--notify` | `#FF6B6B` | Notification dot (only if notifications exist) |
| `--focus` | `#3D8BD1` | Focus ring on every surface |
| `--poster-full` | `#145C3A` | Funding poster band: full funding |
| `--poster-tuition` | `#0B3F70` | Funding poster band: full or partial tuition |
| `--poster-other` | `#3A4A5E` | Funding poster band: stipend, travel, varies, unknown |
| `--saver-bg` / `--saver-ink` | `#FFF4D6` / `#5C4300` | Data saver banner |

Country tints (data saver and missing-photo fallback): FI `#10304F`; SE, NO, DK, IE `#2C5D7A`; DE `#2E5B82`; NL `#A54A33`; BE, FR, GB `#3B4763`; any other `#3A4A5E`. White text passes on all of them.

Remap shadcn tokens to the new palette: `--background: var(--paper)`, `--foreground: var(--ink)`, `--primary: var(--kick-blue)`, `--primary-foreground: #fff`, `--destructive: var(--kick-red)`, `--border: var(--line)`, `--input: var(--line-strong)`, `--ring: var(--focus)`, `--muted-foreground: var(--ink-3)`. Keep `--surface` and `--surface-alt` but point them at `--paper` and `--grey-tint`.

Tailwind (v4 shape; if the project is on v3, add the same names under `theme.extend.colors` and `fontFamily` in `tailwind.config` instead):

```css
@theme inline {
  --color-night: var(--night);
  --color-night-raised: var(--night-raised);
  --color-paper: var(--paper);
  --color-ink: var(--ink);
  --color-ink-2: var(--ink-2);
  --color-ink-3: var(--ink-3);
  --color-line: var(--line);
  --color-line-strong: var(--line-strong);
  --color-track: var(--track);
  --color-kick-blue: var(--kick-blue);
  --color-blue-tint: var(--blue-tint);
  --color-kick-green: var(--kick-green);
  --color-green-text: var(--green-text);
  --color-green-tint: var(--green-tint);
  --color-kick-red: var(--kick-red);
  --color-red-text: var(--red-text);
  --color-red-deep: var(--red-deep);
  --color-red-tint: var(--red-tint);
  --color-grey-tint: var(--grey-tint);
  --color-slate: var(--slate);
  --color-on-night: var(--on-night);
  --color-on-night-muted: var(--on-night-muted);
  --color-on-night-success: var(--on-night-success);
  --color-on-night-danger: var(--on-night-danger);
  --color-on-night-link: var(--on-night-link);
  --font-display: var(--font-bricolage);
  --font-sans: var(--font-atkinson);
}
```

### 5.2 Verified contrast pairs

Computed with the WCAG 2 formula. Only these pairs are used for text.

| Pair | Ratio | Allowed for |
| --- | --- | --- |
| Ink `#0E1B2A` on paper `#F3F5F8` | 15.91 | All text |
| Ink on white | 17.37 | All text |
| Ink-2 `#2B3A4B` on white | 11.61 | All text |
| Ink-3 `#546477` on white | 6.06 | All text |
| Ink-3 on paper | 5.55 | All text |
| Kick Blue on white | 8.36 | All text |
| Kick Blue on blue tint | 7.26 | All text |
| White on Kick Blue | 8.36 | All text |
| Kick Green `#2E8B57` on white | 4.25 | **Icons, bars, text ≥ 24px only** |
| Green text `#1F7A4D` on white | 5.32 | All text |
| Green text on green tint | 4.69 | All text |
| Kick Red on white | 5.62 | All text |
| Red text `#B3261E` on red tint | 5.72 | All text |
| Red deep `#8E1F1A` on red tint | 7.79 | All text |
| Slate on grey tint | 7.98 | All text |
| White on night | 17.04 | All text |
| On-night muted on night | 9.90 | All text |
| On-night success on night | 9.30 | All text |
| On-night danger on night | 8.47 | All text |
| On-night link on night | 9.70 | All text |
| White on poster full / tuition / other | 8.01 / 10.72 / 9.05 | All text |
| Saver ink on saver bg | 8.49 | All text |
| Unverified `#6B7A8C` on white | 4.39 | **Non-text only** (dial arc) |

Red and green are hard to tell apart for many colour-blind users and have similar lightness here. Every red or green signal MUST also carry an icon and words.

### 5.3 Typography

Fonts in `app/layout.tsx`:

```tsx
import { Bricolage_Grotesque, Atkinson_Hyperlegible_Next } from "next/font/google";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  axes: ["opsz"],               // optical sizing keeps big titles tight
  variable: "--font-bricolage",
  display: "swap",
});

const sans = Atkinson_Hyperlegible_Next({
  subsets: ["latin"],
  variable: "--font-atkinson",
  display: "swap",
});

// <html lang="en-GB" className={`${display.variable} ${sans.variable}`}>
// <body className="font-sans bg-paper text-ink antialiased">
```

If the installed Next.js version doesn't export `Atkinson_Hyperlegible_Next` (the family was added to Google Fonts in February 2025): first check whether a minor upgrade of Next.js is safe and ask Jarvis; otherwise self-host the variable WOFF2 with `next/font/local` (from the official `googlefonts/atkinson-hyperlegible-next` release or a Fontsource package; check the exact package name on npm). Never silently fall back to Inter.

Remove the `JetBrains_Mono` and `Inter` loaders once nothing uses them. Re-implement the existing `Mono` component as `<span className="tabular-nums">` in the current font, keeping its props, so call sites don't change. Admin tables MAY use `font-mono` (system `ui-monospace`) for URLs and IDs.

Type scale:

| Role | Font | Size / line-height | Weight | Tracking | Where |
| --- | --- | --- | --- | --- | --- |
| Display XL | Bricolage | `clamp(42px, 5.2vw, 72px)` / 0.98 | 700 | −0.035em | Billboard title (`text-wrap: balance`) |
| Display L | Bricolage | `clamp(34px, 4.2vw, 60px)` / 1.0 | 700 | −0.03em | Detail page H1 |
| Page H1 | Bricolage | 32px → 40px at ≥768 / 1.1 | 700 | −0.02em | Catalogue, My plan, Profile titles |
| Section H2 | Bricolage | 22px → 26px at ≥768 / 1.2 | 700 | −0.02em | Rail and section headings |
| Poster title | Bricolage | 18px / 1.22 (mobile 17px) | 650 | −0.01em | Programme posters, 2-line clamp |
| Card title | Atkinson | 16px / 1.3 | 700 | 0 | Tickets, funding posters, rows |
| Body | Atkinson | 16px / 1.5 | 400 | 0 | Paragraphs |
| Body small | Atkinson | 15px / 1.45 | 400 | 0 | Card descriptions, unlock body |
| Meta | Atkinson | 14px / 1.4 | 400–700 | 0 | Facts, university line |
| Caption | Atkinson | 13px / 1.35 | 700 | 0 | Pills, badges, dates. Smallest text size in the app |
| Dial number S / M / L | Bricolage | 15 / 21 / 30px | 750 | 0 | Score dials 46 / 60 / 88px |
| Countdown | Bricolage | 44px / 1 (mobile 38px) | 750 | −0.03em | Ticket stub |
| Amount | Bricolage | 52 / 46 / 38 / 30px / 1 | 750 | −0.03em | Funding poster, by string length (§9.1.6) |

Rules: all numbers (scores, money, counts, dates) use `tabular-nums`. Sentence case everywhere. No all-caps labels and no letter-spaced eyebrows (admin headings are uppercase today: change them). Never colour single words inside a headline (the landing hero does this today: change it in Phase 7). Monogram letters inside logo tiles are decorative and exempt from the 13px minimum.

### 5.4 Shape, elevation, spacing, layout

Radius:

| Element | Radius |
| --- | --- |
| Poster cards (programme, funding) | 18px |
| Tickets, application cards, rows, tiles, fact tiles | 16px |
| Panels on detail pages | 20px |
| Unlock card, mobile featured card | 22px |
| Logo tile | ≈27% of size: 32→9, 40→11, 44→12, 46→13, 52→14, 56→15, 64→17, 72→18 |
| Buttons, chips, pills, search | 999px |
| Flags | 2px |

Elevation (only these):

| Name | Value | Use |
| --- | --- | --- |
| hairline | `0 1px 2px rgba(7,29,51,.06), 0 0 0 1px var(--line)` | Every card on paper |
| raised | `0 22px 48px rgba(7,29,51,.18), 0 2px 6px rgba(7,29,51,.08)` | Unlock card, popovers, compare tray |
| preview | `0 22px 44px rgba(7,29,51,.20), 0 0 0 2px var(--kick-blue)` | Poster in hover-preview state |
| tile-on-image | `0 0 0 1px rgba(14,27,42,.06), 0 6px 16px rgba(7,29,51,.18)` | Logo tiles and dials over images |
| tile-on-white | `0 0 0 1px #E1E6EC` | Logo tiles on white cards |

Spacing and widths:

- Page gutter `--gutter: clamp(16px, 4vw, 56px)`. Everything left-aligns to it. Rails bleed off the right edge.
- Home section rhythm: 48px between sections; heading to content 14–16px.
- Card padding 16–18px; detail panels 24px.
- Rail gaps: 20px for posters, 18px for tickets and destination tiles.
- Max widths: grids and text blocks 1328px; billboard copy 720px; detail main column ≤ 860px; long text 70ch.

Breakpoints (Tailwind defaults):

| Width | Behaviour |
| --- | --- |
| < 768 | Mobile header + bottom tab bar; rails show about 1.4 cards; featured card replaces billboard |
| ≥ 768 | Desktop top bar |
| ≥ 1024 | Detail pages two columns; Home application cards three across |
| ≥ 1280 | Catalogue list view shows the preview pane |

### 5.5 Motion

- No autoplay anywhere.
- Hover preview: opens after 250ms of hover intent, 150ms fade. No scale transforms that shift layout.
- Score dial arc animates once on first paint (600ms ease-out).
- Save toggle: bookmark icon pops to 1.15× for 150ms.
- Rails scroll smoothly from prev/next buttons.
- With `prefers-reduced-motion: reduce` all of the above are instant. Keep the existing global rule.

### 5.6 Icons

Keep Lucide (2px stroke; sizes 14, 16, 18, 20, 22, 26). Icon-only buttons need `aria-label`; decorative icons get `aria-hidden`. Names to use (check exact export names in the installed `lucide-react`): `Search`, `Bell`, `Bookmark`, `Check`, `CircleCheck`, `CircleAlert`, `CircleHelp`, `Clock`, `Calendar`, `GraduationCap`, `Coins`, `ShieldCheck`, `Globe`, `ExternalLink`, `Columns2` (compare), `Share2`, `ClipboardList` (track), `KeyRound` (unlock), `TrendingUp`, `ChevronLeft`, `ChevronRight`, `House`, `Compass`, `User`, `SlidersHorizontal`, `X`.

---

## 6. Identity system

### 6.1 `InstitutionLogo`

```ts
type InstitutionLogoProps = {
  name: string;                 // always printed next to the tile, so the tile is decorative
  logoUrl?: string | null;      // our cached URL (§11)
  acronym?: string | null;      // from ROR names (type "acronym") if stored
  seed: string;                 // institution id, for stable colour
  size: 32 | 40 | 44 | 46 | 52 | 56 | 64 | 72;
  surface?: "image" | "white";  // picks the shadow (§5.4)
  className?: string;
};
```

- Renders a white tile (radius per §5.4), `aria-hidden="true"`, padding `round(size * 0.14)`, the logo `object-contain` via `next/image` with `alt=""`.
- No `logoUrl`, or the image fails to load (`onError`, so a tiny client wrapper is needed): render the **monogram**.
- Monogram text: the acronym if it is 2–5 letters after removing spaces; otherwise the first letter of up to three significant words of the name. Uppercase.
- Monogram colour: `PALETTE[hash32(seed) % PALETTE.length]`. Every colour below passes 4.99:1 or better on white: `#1D5FA8, #B45309, #0F766E, #7C3AED, #BE123C, #4D7C0F, #9A3412, #0369A1, #A21CAF, #334155`.
- Monogram type: Bricolage 750, letter-spacing −0.02em, font size = size × 0.34 (1–2 letters), × 0.30 (3 letters), × 0.25 (4–5 letters).

```ts
// lib/ui/monogram.ts
const STOP = new Set(["of","the","and","for","at","in","on","de","des","du","la","le","les",
  "di","del","della","der","den","van","von","für","fur","und","et","y","i","&"]);

export function hash32(s: string): number {           // FNV-1a
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

export function monogramText(name: string, acronym?: string | null): string {
  const a = acronym?.replace(/\s+/g, "");
  if (a && a.length >= 2 && a.length <= 5) return a.toUpperCase();
  const words = name.split(/[\s\-–—/,]+/).filter(Boolean).filter(w => !STOP.has(w.toLowerCase()));
  const letters = words.slice(0, 3).map(w => Array.from(w)[0]).join("");
  return (letters || Array.from(name.trim()).slice(0, 2).join("")).toUpperCase();
}
```

Unit tests MUST cover: "University of Helsinki" → `UH`; "University College Dublin" → `UCD`; "KU Leuven" → `KL`; name with acronym "RWTH" → `RWTH`; "Université Paris-Saclay" → `UPS`; "Universität Hamburg" → `UH`; same seed always gives the same colour.

### 6.2 `CountryFlag`

- Use the `flag-icons` package (MIT, SVG flags via CSS classes `fi fi-xx`). Import its CSS once in `app/layout.tsx`. Read its README to confirm class names before use.
- Size 20×15 (4:3) by default; 22×16 on destination tiles. Radius 2px. Inner ring `box-shadow: 0 0 0 1px rgba(14,27,42,.15)` (on night: `rgba(255,255,255,.3)`).
- Always `aria-hidden="true"`; the country name is always printed next to it.
- Unknown or missing code: render the `Globe` icon instead.
- Country names: `new Intl.DisplayNames(["en-GB"], { type: "region" }).of(code)` in a `countryName(code)` util with fallback to the code. Cards MUST show names, not raw codes (closes a known gap).

### 6.3 `CoverImage`

The poster art. Priority order:

1. **Campus photo** cached by the media pipeline (§11): `next/image` with `fill`, `object-cover`, `object-position: center`, background colour = `coverColor` while loading, `loading="lazy"` except the billboard and detail banner (`priority`). Consistent treatment so mixed-quality photos look like one family: `filter: saturate(.92) contrast(1.02)`.
2. **Illustrated scene** when there is no photo: one of five static SVGs in `public/scenes/` (Appendix A), picked by country (Appendix B). Where a country allows several scenes, pick with `hash32(institutionId) % options.length` for variety. Use `object-position: center bottom`.
3. **Data saver on**: never 1 or 2. Render the country tint (§5.1) with the city name bottom-right in white, Bricolage 700 15px at 88% opacity.

```ts
type CoverImageProps = {
  institutionId: string;
  countryCode?: string | null;
  city?: string | null;
  photo?: {
    url: string; width: number; height: number;
    color?: string | null; credit?: string | null; license?: string | null; sourceUrl?: string | null;
  } | null;
  sizes: string;        // see §12.2
  priority?: boolean;
  className?: string;
};
```

Covers are decorative (`alt=""`) because the title is always next to them. Detail banners show the photo credit (§9.3).

### 6.4 `ScoreDial` and strength

Strength rules (unchanged from today):

| Strength | When | Accent |
| --- | --- | --- |
| Strong match | Verified data, score ≥ 85 | `--kick-green` |
| Likely eligible | Verified data, score 70–84 | `--kick-green` |
| Potential match | Verified 45–69, or unverified < 70 | `--kick-blue` |
| Needs verification | Unverified, score ≥ 70 | `--unverified` |
| Missing requirement | Fails a requirement outright, or verified < 45 | `--kick-red` |

```ts
type ScoreDialProps = {
  score: number;              // 0–100
  strength: Strength;
  size: 46 | 60 | 88;         // geometry: 46 → r18 stroke4, 60 → r25 stroke5, 88 → r37 stroke6
  tone: "light" | "night";    // light: white disc + tile-on-image shadow, track --track; night: no disc, track --on-night-line
  animate?: boolean;
};
```

SVG: track circle + arc circle with `pathLength="100"`, `stroke-dasharray="{score} 100"`, round caps, rotated −90°. On night the arc is `--on-night-success` for green strengths. Number centred (dial number style). The wrapper has `role="img"` and `aria-label="92 percent match, Strong match"`.

### 6.5 Badges

- `SourceBadge`: verified → green tint, green text, `ShieldCheck`, "Verified source". External → grey tint, slate text, `Globe`, "Needs verification", with a tooltip: "Found on a third-party site and not yet checked against the official page." Night variant (banners): background `rgba(111,211,155,.16)`, text `#A6EBC4`.
- `RequirementBadge` (detail pages): "Verified" (green tint) / "Unverified" (outline, `--line-strong`, ink-3 text).
- `StrengthBadge` (existing): restyle with the accents in §6.4, 13px bold pill, tint backgrounds (green tint, blue tint, grey tint, red tint).

---

## 7. App shell and navigation

### 7.1 Desktop top bar (≥ 768px)

Two variants, chosen from the pathname in the app shell:

| Variant | Routes | Look |
| --- | --- | --- |
| `night` | `/dashboard`, `/programs/[id]`, `/scholarships/[id]`, `/institutions/[id]` | Transparent, absolutely positioned over the page's night banner (`top: 0`, full width, z-index 30). The banner reserves 80px at the top. White wordmark; links `--on-night-muted`; current link white with a 2px white underline; search pill `rgba(255,255,255,.1)` with `#D5E0EC` text |
| `light` | Everything else | White bar, hairline bottom border, sticky with backdrop blur (current behaviour). Wordmark Kick Blue; links ink-3; current link Kick Blue with a 2px underline |

Contents, left to right, height 80px, padding `18px var(--gutter)`:

1. Wordmark "KickScholar" (Bricolage 750, 24px, −0.03em) → `/dashboard`.
2. Nav: Home, Programmes, Scholarships, Universities, My plan. Current item has `aria-current="page"`.
3. Search pill (44px tall, "Search programmes or universities") → `/programs?focus=search`, which autofocuses the catalogue search box.
4. Notification bell: render **only** when a notifications feature exists. It doesn't today, so hide it.
5. Avatar button (44px, Kick Blue, first initial, 2px ring `rgba(255,255,255,.35)` on night) opening a menu: name/email, Profile, Eligibility report, Data saver (switch), Admin (admins only), Sign out.

MAY: on night pages, after the user scrolls past the banner, swap to the sticky light variant.

### 7.2 Phones (< 768px)

- Header: on night pages a transparent night row (wordmark 22px, search icon button, avatar); elsewhere white.
- Bottom tab bar, four tabs: **Home** (`/dashboard`, `House`), **Explore** (`/programs`, `Compass`), **My plan** (`/plan`, `ClipboardList`), **Profile** (`/profile`, `User`). 64px plus `env(safe-area-inset-bottom)`. Labels 13px. Active tab Kick Blue. Content keeps bottom padding 80px plus the inset.
- Explore pages show a segmented control at the top: Programmes | Scholarships | Universities.
- The hamburger drawer is removed. Eligibility is reachable from the Home unlock card, Profile and the avatar menu; Admin from the avatar menu.

### 7.3 Routes and labels

| Label | Route | Notes |
| --- | --- | --- |
| Home | `/dashboard` | |
| Programmes | `/programs` | Label British, path unchanged |
| Scholarships | `/scholarships` | |
| Universities | `/institutions` | Label changes from "Institutions" |
| My plan | `/plan` (new) | Tabs `?tab=saved` and `?tab=applications`. `/saved` and `/applications` redirect to the matching tab. Update every `revalidatePath` that pointed at the old paths |
| Eligibility report | `/eligibility` | Not in the top nav |
| Profile | `/profile` | |
| Compare | `/compare?type=program&ids=a,b,c` (new, Phase 4c) | |
| Admin | `/admin/*` | Avatar menu, admins only |

### 7.4 Page titles (closes "every tab is titled KickScholar")

Root layout: `title: { template: "%s | KickScholar", default: "KickScholar" }`. Each route sets its own: "Home", "Programmes", "Scholarships", "Universities", "My plan", "Your profile", "Eligibility report". Detail pages use `generateMetadata`: "{Programme} at {Institution}", "{Scholarship}", "{Institution}". Catalogue with a query: "Search: {q} in Programmes".

### 7.5 Loading, error, not found (closes known gaps)

- `loading.tsx` for the app segment root and for `/dashboard`, `/programs`, `/programs/[id]`, `/scholarships`, `/scholarships/[id]`, `/institutions`, `/institutions/[id]`, `/plan`. Skeletons mirror the final layout: night banner block, rails of poster-shaped boxes, fact tiles. Use the existing `Skeleton` component in `--track`; no shimmer with reduced motion.
- `error.tsx` (client component) in the app segment: heading "This page didn't load", body "Something went wrong on our side. Try again, or go back to Home.", buttons "Try again" (`reset`) and "Go to Home". Log the error digest.
- `not-found.tsx` globally and for detail segments: "We can't find that programme" (or scholarship/university) with a button back to the catalogue.

---

## 8. New components

Put KickScholar components in `components/kick/`. Leave shadcn primitives in `components/ui/` alone apart from token-driven styling. Server components by default; `"use client"` only where noted.

| Component | File | Client | Spec |
| --- | --- | --- | --- |
| `InstitutionLogo` | `institution-logo.tsx` | tiny wrapper for `onError` | §6.1 |
| `CountryFlag` | `country-flag.tsx` | no | §6.2 |
| `CoverImage` | `cover-image.tsx` | no | §6.3 |
| `ScoreDial` | `score-dial.tsx` | no | §6.4 |
| `SourceBadge`, `RequirementBadge` | `badges.tsx` | no | §6.5 |
| `SaveButton` | `save-button.tsx` | yes | Wraps the existing optimistic save action. Variants: `onImage` (36px white disc inside a 44px hit area), `outline` (44px circle), `night` (52px pill with visible text "Save"/"Saved"). Icon-only variants use `aria-pressed` with a constant label "Save {title}" |
| `SectionHeading` | `section-heading.tsx` | no | H2 + optional pill + right-side actions |
| `Rail` | `rail.tsx` | yes | §9.1.4 |
| `Billboard` | `billboard.tsx` | yes (pager) | §9.1.1 |
| `FeaturedCarousel` | `featured-carousel.tsx` | yes | Mobile replacement for the billboard, §9.1.8 |
| `UnlockCard` | `unlock-card.tsx` | no | §9.1.2 |
| `ApplicationProgressCard` | `application-progress-card.tsx` | no | §9.1.3 |
| `MatchPosterCard` | `match-poster-card.tsx` | yes (preview) | §9.1.5; fixed size for rails, fluid for grids |
| `DeadlineTicket` | `deadline-ticket.tsx` | no | §9.1.6 |
| `FundingPoster` | `funding-poster.tsx` | no (contains `SaveButton`) | §9.1.6; full and compact sizes |
| `OneAwayCard` | `one-away-card.tsx` | no | §9.1.6 |
| `DestinationTile` | `destination-tile.tsx` | no | §9.1.6 |
| `FactGrid` | `fact-grid.tsx` | no | §9.3 |
| `RequirementComparison` | `requirement-comparison.tsx` | no | §9.3 |
| `ScoreBreakdown` | `score-breakdown.tsx` | no | §9.3 (reuse the eligibility factor data) |
| `NextSteps` | `next-steps.tsx` | yes | §9.3 |
| `KeyDates` | `key-dates.tsx` | no | §9.3 |
| `ProvenanceCard` | `provenance-card.tsx` | no | §9.3 |
| `CompareTray` + context | `compare-tray.tsx` | yes | §9.6 |
| `TopNav`, `MobileHeader`, `TabBar`, `AvatarMenu` | `app-shell/*.tsx` | partly | §7 |
| `DataSaverProvider`, `DataSaverSwitch` | `data-saver.tsx` | yes | §12.1 |

Utilities in `lib/ui/`: `monogram.ts` (§6.1), `country.ts` (names, tints, scenes), `format.ts` (money, dates, countdowns, durations, plurals), `strength.ts` (re-export of the existing helper plus accent mapping), `coverage.ts` (labels and band colours).

A dev-only page `app/(dev)/kit/page.tsx` (404 in production) MUST render every component above with fixture data (Appendix C) at once. It is our Storybook and the place for screenshots.

---

## 9. Screens

### 9.1 Home — `/dashboard` (profile exists)

Desktop wireframe (1440 wide). `[ ]` marks icons; there are no emoji in the real UI.

```
┌──────────────────────────────── night zone, about 740px ───────────────────────────────┐
│ KickScholar  Home  Programmes  Scholarships  Universities  My plan  [Search…]   (T)    │
│                                                                                         │
│ [UH] University of Helsinki                         ░░░░ cover image, right 74%, ░░░░░ │
│      [flag] Helsinki, Finland                       ░░░░ fading into night on the ░░░░ │
│ MSc in Computer Science                             ░░░░ left and at the bottom   ░░░░ │
│ [ok] Your BSc in Computer Science is a direct fit                                      │
│ [ok] Your 3.72 CGPA clears the entry bar                                               │
│ [!]  Needs IELTS 6.5, or a letter showing your degree was taught in English            │
│ (92) Strong match, 92%   [coins] Scholarship can cover full tuition   [clock] Closes 2 Jan │
│ [See why you match] [Save]                                   Top match 1 of 3  ━ ─ ─   │
└─────────────────────────────────────────────────────────────────────────────────────────┘
   ┌ unlock card, overlaps the billboard by 68px ─────────────────────────────────────┐
   │ [key] 23 more programmes open up when you add an English test score              │
   │       Add your IELTS or TOEFL result…            [Add test score] [Upload a letter]│
   └───────────────────────────────────────────────────────────────────────────────────┘
 Pick up where you left off                                                Open My plan
 [application card] [application card] [application card]

 Strong matches for you  (4 new since Friday)                    See all 34   (<) (>)
 [poster] [poster] [poster in preview state] [poster] [poster] …

 Closing soon                                                                 (<) (>)
 [12 days left | ticket] [19 | ticket] [25 | ticket] [31 | ticket] …

 Funding you qualify for                                          See all 61   (<) (>)
 [€1,400 poster] [100% poster] [SEK 12,000 poster] [€5,000 poster] [To be confirmed] …

 One requirement away
 Close one gap and these become strong matches.
 [one-away card] [one-away card] [one-away card]

 Browse by destination
 [Germany 38] [Netherlands 21] [Sweden 17] [Finland 14] [Belgium 12] [Ireland 9]
```

#### 9.1.1 Billboard

Layout:

- Section: `position: relative; overflow: hidden; background: var(--night); min-height: 700px`. Top 80px reserved for the night top bar.
- Cover: right-aligned, 74% width, full height (`CoverImage`, `priority`, `sizes="(min-width: 768px) 74vw, 100vw"`).
- Overlay 1, left to right: `linear-gradient(90deg, #071D33 0%, #071D33 28%, rgba(7,29,51,.86) 44%, rgba(7,29,51,.22) 70%, rgba(7,29,51,0) 100%)`.
- Overlay 2, bottom: 180px tall, `linear-gradient(0deg, #071D33, rgba(7,29,51,0))`.
- Copy block: max-width 720px, padding `36px var(--gutter) 136px`, vertical gap 22px:
  1. Logo 56 (`surface="image"`) + university name (17px, 700) + flag and "City, Country" (14px, on-night-muted).
  2. H1 programme title, Display XL.
  3. Reasons list, max 3, 16px, `#E3EBF4`: icon 20px, met = `CircleCheck` on-night-success, gap = `CircleAlert` on-night-danger.
  4. Facts row (wraps, gap 14px 28px): `ScoreDial` 60 night + "{Strength}, {score}%" (16px 700) over the basis line (13px on-night-muted); funding line with `Coins` (on-night-success); deadline line with `Clock`.
  5. Buttons: primary white pill 52px "See why you match" → `/programs/[id]#why`; `SaveButton` night variant.
- Pager: absolute, right `var(--gutter)`, bottom 92px: text "Top match {n} of 3" (14px, on-night-muted) + three 44×44 buttons, each drawing a 4px bar (current 36px wide white, others 18px at 40% white). Labels "Show top match 2". Changing slide updates a visually hidden `aria-live="polite"` line: "Showing top match 2 of 3: MSc in Data Science, RWTH Aachen University".

Data rules:

- Candidates: programme matches with strength Strong match or Likely eligible, next deadline in the future or unknown. Sort by score desc, then "has officially linked funding", then soonest deadline. Take 3.
- Fallback: top 3 programme matches that are not Missing requirement. If none: replace the billboard with a night hero: "No strong matches yet" + body "Widen your preferences or add missing details to see more." + buttons "Edit preferences" (`/profile#preferences`) and "Browse programmes".
- Reasons: from the match's factor explanations. Two highest-weight met factors, then the first blocker. Keep each under about 80 characters, using the short templates in §14.5 if the stored explanation is longer.
- Funding line: officially linked scholarship covering tuition → "{scholarship short name} can cover {coverage}"; else free tuition → "No tuition fees"; else tuition → "€18,000 a year"; else hide.
- Deadline line: "Applications close {2 Jan}, in {53} days" / "Applications close tomorrow" / "Applications close today"; unknown → "Deadline not published yet".
- Basis line: "{met} of {evaluated} checks met" if the engine exposes it; otherwise hide.

#### 9.1.2 Unlock card

- Overlaps the billboard: `margin-top: -68px; position: relative; z-index: 4`, inside the gutter, max-width 1120px, radius 22, `raised` shadow, padding `20px 24px`, flex-wrap row:
  - Icon tile 52px, blue tint, `KeyRound` 26px Kick Blue.
  - Text block (`flex: 1 1 380px`): title 18px 700, body 15px ink-3.
  - Actions: primary pill 48px (Kick Blue) + optional outline pill 48px.
- Source: the top improvement action from the eligibility engine ("What you can do to improve it", already ordered by how many opportunities it unlocks). Copy templates in §14.4.
- If there's no action and profile completeness < 100%: title "Finish your profile to sharpen your matches", body "{n} of 8 details added.", button "Finish profile".
- If neither: don't render it, and give the billboard its normal bottom edge (the next section must not slide up under the billboard).
- Buttons deep-link to profile sections with ids `#personal`, `#academic`, `#preferences`, `#language`, `#experience` (add these ids in Phase 2).
- "Upload a letter" only appears if a document upload feature exists. Otherwise show a single button.

#### 9.1.3 "Pick up where you left off"

- Data: the user's applications not in Accepted or Rejected, sorted by nearest future deadline (unknown last), then most recently updated. Max 3. Hide the section when empty.
- Grid `repeat(auto-fill, minmax(300px, 1fr))`, gap 16px, max-width 1328px.
- Card: radius 18, hairline, padding 18, column gap 14:
  1. Logo 44 (`surface="white"`) + title (16px 700) over organisation (14px ink-3) + stage pill (13px 700): In progress → blue tint/Kick Blue; Saved, Planning → grey tint/slate; Submitted → green tint/green text.
  2. "{done} of {total} documents ready" + deadline ("Closes 2 Jan", ink-3) above an 8px progress bar (track `--track`, fill Kick Blue).
  3. "Next: {first unchecked document, lower-case first letter}" + "Continue" pill (blue tint, 44px) → `/plan?tab=applications#app-{id}`.
- No checklist yet: row 2 says "No checklist yet"; row 3 says "Next: add your document checklist".

#### 9.1.4 `Rail` (shared behaviour)

- Header: `SectionHeading` with the H2, optional pill (blue tint, 13px 700: "{n} new since {Friday}"), and on the right a "See all {n}" link (15px 700) plus previous/next buttons (44px outline circles, `ChevronLeft`/`ChevronRight`, labelled per rail: "Previous matches", "More matches"). Buttons are hidden on touch devices (`@media (hover: none)`) and disabled at either end.
- Track: `display: flex; gap; overflow-x: auto; scroll-snap-type: x mandatory; scroll-padding-inline-start: var(--gutter); padding: 4px var(--gutter) 28px`. Hide the scrollbar visually (`scrollbar-width: none` plus the WebKit rule) but keep it scrollable by touch, trackpad and keyboard. Items `scroll-snap-align: start; flex: 0 0 auto`.
- Buttons scroll by `track.clientWidth - cardWidth` (smooth unless reduced motion).
- Semantics: `<section aria-labelledby>` containing `<ul role="list">` of `<li>` items.
- Max 20 items per rail. Images lazy. A rail with zero items is not rendered.

#### 9.1.5 Strong matches — `MatchPosterCard`

Size: desktop 272 × 384; mobile 236 × 300; grid mode fluid (width 100%, cover keeps 16:9).

Anatomy (desktop):

- Cover 153px tall (16:9), radius `18px 18px 0 0`.
- `ScoreDial` 46 light at top 10, left 10.
- `SaveButton` onImage at top 6, right 6.
- Logo 52 at top 127, left 16, overlapping the cover edge (`surface="image"`).
- Body padding `34px 16px 16px`, column gap 6:
  - Title link (poster title style, 2-line clamp) → detail page.
  - **Normal state**: university line (flag + name, ellipsis, 14px ink-3); facts pinned to the bottom (`margin-top: auto`), 14px with 16px icons: funding (`Coins`, green text 700 when it's positive funding such as free tuition or a linked scholarship, otherwise ink-2), length (`GraduationCap`, "2 years, full-time"), deadline (`Clock`, "Closes in 53 days"; Kick Red text and icon when ≤ 14 days).
  - **Preview state** (replaces the university line and facts): up to 3 reasons (14px; `Check` Kick Green / `CircleAlert` Kick Red), then an action row: "Open programme" (Kick Blue pill 44px, `flex: 1`), Compare (44px outline icon button), Track (44px outline icon button).
- Fixed height so the preview never shifts layout.
- Preview opens on pointer hover after 250ms, or on keyboard focus inside the card (`:focus-within`). Only on `(hover: hover) and (pointer: fine)`. Touch devices never show it.
- Mobile size drops the length fact (funding and deadline only) and uses logo 44 at top 111; the dial stays 46.

Data: programme matches with strength Strong match or Likely eligible, score desc, max 20. "See all {n}" → `/programs?sort=best&qualify=1`. The "new" pill counts these matches whose programme first appeared after the user's previous Home visit (§10.3); hidden when 0.

#### 9.1.6 Other rails

**Closing soon — `DeadlineTicket`** (desktop 340 × 132; mobile 300 × 124, stub 84px):

- Stub 96px wide: days number (countdown style) over "days left" (13px 700). ≤ 14 days: red tint background, red text. Otherwise blue tint, Kick Blue. 1 day → "1 day left"; 0 → "Today" with no label.
- Perforation: 2px dashed `#D5DCE4` vertical line, inset 14px top and bottom. Notches: 18px circles in `--paper` centred on the perforation at the top and bottom edges (−9px), so they look punched out.
- Body padding `14px 16px`: logo 32 + organisation (13px ink-3, ellipsis); title (card title, 2 lines); "Closes {Sun 22 Nov}" with `Calendar` 14px (13px ink-3).
- Data: programme and scholarship matches (not Missing requirement) with a future deadline within 45 days, soonest first, max 12. Hide the rail when empty.
- "Add deadlines to calendar" link → `/api/calendar/deadlines.ics` only once that route exists (Phase 6 MAY). Hidden until then.

**Funding you qualify for — `FundingPoster`** (desktop 272 × 340; mobile 220 × 316; compact variant for detail pages: band 120px, auto height):

- Band 176px (mobile 150px), colour by coverage: full funding `--poster-full`; full or partial tuition `--poster-tuition`; stipend, travel, varies, unknown `--poster-other`. Padding `16px 18px`.
- Rosette ornament (Appendix A.6): 240px, positioned at right −78px, top −70px, white 1px strokes at 16% opacity, `aria-hidden`. Banknote vernacular, keep it this subtle.
- Top row: `Coins` 16px + coverage label (13px 700): "Full funding", "Full tuition", "Partial tuition", "Stipend", "Travel only", "Varies", "Amount not published".
- Amount: Bricolage 750, size by length of the formatted string: ≤ 5 chars 52px, ≤ 7 46px, ≤ 10 38px, else 30px. No amount → "To be confirmed" at 30px. Per-line under it (14px, white at 88%): "a month, plus tuition and travel", "of tuition, every year", "paid in your first year".
- `SaveButton` onImage at top right. Provider logo 46 at top 152 (mobile 126), left 16.
- Body padding `32px 16px 16px`: title (card title, 2 lines), provider (14px ink-3), bottom row: `SourceBadge` + deadline (13px ink-3).
- Money: `Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 })` → "€1,400". For SEK, NOK, DKK, CHF use `currencyDisplay: "code"` → "SEK 12,000". Tuition waivers stored as a percentage show "100%".
- Data: scholarship matches with strength Strong match, Likely eligible or Needs verification (the badge explains), score desc, max 20. "See all {n}" → `/scholarships`.

**One requirement away — `OneAwayCard`** (360px wide, height follows content; rail stretches all cards to the tallest):

- Logo 44 + title (16px 700) over organisation (14px ink-3).
- Gap box: red tint, radius 12, padding `10px 12px`, `CircleAlert` 18px Kick Red, text 14px/1.4 red deep. Compose as "{requirement}. {your status}." (for example "Needs IELTS 6.5 with at least 6.0 in each part. You have not added a test yet.").
- Bottom row: "Match rises from {from} to {to}" (green text 700, `TrendingUp`) + action pill (outline, 44px) labelled per blocker type (§14.4).
- Data: matches whose current strength is Potential match or Missing requirement, that have exactly one blocker, and whose projected score (§10.4) reaches 70 or more. Sort by projected gain desc. Max 10. No projection available → drop the "rises" line and keep the card.

**Browse by destination — `DestinationTile`** (desktop 220 × 148; mobile 180 × 128):

- Cover = the country's scene (Appendix B), not an institution photo, so the rail stays calm.
- Bottom bar `rgba(7,29,51,.8)`, padding `10px 14px`: flag 22×16 + country name (16px 700 white) over "{n} matches for you" (13px `#C9D6E4`).
- Whole tile is one link → `/programs?country={CC}`.
- Data: the user's matches that are not Missing requirement, grouped by institution country, sorted desc, max 10.

#### 9.1.7 Data saver banner

When data saver is on, a full-width banner sits above the billboard: saver colours, 14px 700, padding `10px var(--gutter)`, `role="status"`: "Data saver is on. Pictures stay hidden until you turn it off." with a "Turn off" button (underlined text button).

#### 9.1.8 Mobile Home (< 768px)

- Night zone: mobile header; greeting "Good {morning|afternoon|evening}, {first name}" (Bricolage 28px 700, time of day in Africa/Lagos) over "{n} new matches since {Friday}" (15px on-night-muted; hide when 0).
- `FeaturedCarousel` replaces the billboard: up to 3 cards in a horizontal scroll-snap row with a 16px peek of the next card, dots below (44px hit areas). Card: radius 22, night-raised background; cover 204px with dial 46 top-left, save top-right, logo 52 overlapping the cover edge; body padding `32px 18px 18px`: university (13px 700 on-night-muted) and flag + city; title (Bricolage 28px 700, 3-line clamp); reasons (max 3, 15px); funding and deadline lines; full-width white pill 52px "See why you match".
- Unlock card overlaps the night zone by 48px, stacked: icon + title, body, buttons full width.
- Rails with mobile card sizes and 22px headings; no prev/next buttons.
- Bottom tab bar.

#### 9.1.9 Edge states

- Matches being recomputed after a profile save (if that's async): show skeleton rails and a status line "Updating your matches…".
- Every rail empty: replace the rails with one panel: "Nothing to show yet" + "Add more details to your profile, or widen your preferred countries and fields." + buttons "Edit profile" and "Browse programmes".

### 9.2 Home without a profile

- Night hero (same shell as the billboard, scene cover): H1 Display L "See the universities and scholarships you qualify for"; body "Complete your profile and we'll show you exactly which programmes and scholarships you qualify for."; buttons "Complete your profile" (white pill) and "Browse programmes" (outline on night).
- Below: "Popular destinations" (destination tiles with programme counts per country, not personalised) and "Fully funded scholarships" (funding posters, no dials).

### 9.3 Programme page — `/programs/[id]`

Replace the tabs with one scrolling page. Keep the old tab names as section ids so links keep working: `#overview`, `#requirements`, `#why`, `#funding`, `#application`. If tabs were addressed by query parameter, redirect those URLs to the anchors. MAY: on ≥ 1024px a sticky in-page section bar under the action bar (48px, current section highlighted via `IntersectionObserver`).

```
night banner, min-height about 440px
  Programmes / Finland / University of Helsinki                       (breadcrumb, 14px)
  [logo 72] University of Helsinki        (links to /institutions/[id])
            [flag] Helsinki, Finland
  MSc in Computer Science                                   ┌────────────────────────┐
  [Verified source] [Taught in English] [2 years, full-time]│ (92)  Strong match      │
                                                            │       7 of 8 checks met │
                                                            │       See the breakdown │
                                                            └────────────────────────┘
action bar (white): [Track this application] [Apply on the university site [ext]]  [save] [compare] [share]
fact grid: Tuition | Length | Starts | Applications | Taught in
two columns
  main (flex 999 1 560px)              aside (flex 1 1 340px)
   Why you match           #why         Your next steps
   Funding for this programme #funding  Key dates
   Entry requirements      #requirements Where this comes from
   About this programme    #overview
More like this (rail of MatchPosterCards)
```

- **Banner**: like the billboard with the cover at 70% width and content bottom-aligned (padding `28px var(--gutter) 44px`). Breadcrumb links in `#D5E0EC`. Logo 72. H1 Display L. Pills: `SourceBadge` night variant, then neutral pills (`rgba(255,255,255,.1)` background, `#E3EBF4` text) for teaching language, duration and mode, degree. Score card on the right: background `rgba(7,29,51,.72)`, 1px `rgba(255,255,255,.18)` border, radius 20, padding `18px 22px`: dial 88 night + strength (Bricolage 22px 700) + basis (14px on-night-muted) + "See the breakdown" (on-night-link → `#why`). No match: replace the card with a link "Complete your profile to see your match". Photo credit (when a photo is shown): bottom-right, 13px on-night-muted, "Photo: {credit}, {licence}" linking to the source page.
- **Action bar**: white, hairline bottom, padding `14px var(--gutter)`, wraps.
  - Primary "Track this application" (Kick Blue pill 48px, `ClipboardList`): calls the existing create-application action (seeds the checklist, §9.7). Then it becomes "Tracking in My plan" (green tint, green text, `Check`) linking to `/plan?tab=applications`. This closes the "applications can only be started from Saved" gap.
  - Secondary "Apply on the university site" (outline pill 48px, `ExternalLink`), new tab, `rel="noopener noreferrer"`.
  - Icon buttons (44px outline): Save (`aria-pressed`), Compare (Phase 4c), Share (Web Share API; fallback copies the URL and shows "Link copied").
- **Fact grid**: `repeat(auto-fit, minmax(180px, 1fr))`, gap 12, tiles radius 16 hairline padding `14px 16px`: label (13px ink-3), value (Bricolage 20px 700), note (13px). Tiles: Tuition (Free / amount / Varies / "Not yet published"; note in green text when funding covers it), Length (note: credits if known), Starts (intakes), Applications (window or next deadline; note "Closes in {n} days", Kick Red when ≤ 14), Taught in. Hide tiles with no data.
- **Why you match** (`#why`), panel radius 20 padding 24:
  - Intro (15px ink-3): "Your profile, checked against the requirements on the university's admissions page."
  - `RequirementComparison`: a visual header row (Requirement | They ask for | You have; 13px 700 ink-3) and one row per requirement: status icon (met `CircleCheck` Kick Green; missing `CircleAlert` Kick Red; unknown `CircleHelp` ink-3), requirement (700), what they ask (ink-2), what you have (ink; missing → red text 700 "Not added yet" plus action links from §14.4). Build it as a semantic `<table>` (`<th scope="col">` headers; the requirement name as `<th scope="row">`) with `table-layout: fixed` and column widths 28px / 22% / 44% / auto via `<colgroup>`, inside an `overflow-x: auto` box with `min-width: 560px` so phones scroll it sideways. Rows separated by 1px `--line` top borders, cell padding 14px.
  - "Score breakdown": grid `repeat(auto-fill, minmax(200px, 1fr))`, gap `12px 24px`: label + value% + 8px bar (≥ 70 Kick Green, 40–69 Kick Blue, < 40 Kick Red; not scorable → empty grey bar and "N/A").
  - "What's holding your score back" (heading in ink with a red `CircleAlert` icon) and "What you can do" (blue `TrendingUp`): existing content, restyled as lists with links.
  - No match: keep today's prompt "Complete your profile to see why you match this programme." with a link.
- **Funding for this programme** (`#funding`): the three existing groups with their explanations verbatim (§14.3), each a grid of compact `FundingPoster`s (`repeat(auto-fill, minmax(240px, 1fr))`), max 12 shown then "Show all {n}" expands (keep the current 40-row data cap). Empty copy unchanged.
- **Entry requirements** (`#requirements`): list rows: type (14px 700), text, `RequirementBadge` on the right. Empty copy unchanged.
- **About this programme** (`#overview`): description (max 70ch), field, intakes if not in the fact grid. Empty copy unchanged.
- **Aside — Your next steps** (`NextSteps`): header "Your next steps" + "{done} of {n} done" + 6px progress bar. List (§10.5) with 22px checkboxes (`accent-color: var(--kick-blue)`), label (15px 700) and note (14px ink-3). When tracking, ticks sync with the application's document checklist. When not tracking, ticking shows an inline prompt "Track this application to save your progress" with the Track button.
- **Aside — Key dates** (`KeyDates`): vertical timeline. First item "Today, {10 Nov}" / "You are here" with a filled Kick Blue dot; then each real deadline and intake in date order with hollow dots; past dates in ink-3. Never invent dates (no "results" date unless stored).
- **Aside — Where this comes from** (`ProvenanceCard`): "Sourced from the {source name} page. Last checked on {3 Nov 2026}." + "View the source page" (external) + "Report something wrong" (`mailto:` the support address; hidden if unset).
- **More like this**: `MatchPosterCard` rail, same field and degree level, other programmes, ordered by the user's score (or alphabetically without a profile), max 12, hidden under 3 items.
- The university name everywhere on this page links to `/institutions/[id]` (closes the "directory is a dead end" gap).

### 9.4 Scholarship page — `/scholarships/[id]`

Same structure as §9.3 with these differences:

- **Banner**: a full-width coverage band (colour per §9.1.6) with the rosette ornament instead of a photo. Left: provider logo 72, provider name, `SourceBadge`, H1 scholarship name, pills (country or "Multiple countries", coverage type, degree level). Right: the amount at Display L size with the per-line, and the score card under it.
- Unverified scholarships keep today's grey notice in Overview: discovered via a third-party aggregator and not independently verified, so the details are "a starting point, not confirmed fact".
- Facts: Amount, Coverage, Deadline, Who can apply (nationality summary), Degree level.
- Why you match: same component. No "What you can do" list (as today), unless the data exists.
- **Where this can be used** (`#where`): the two existing groups with verbatim copy and rule text in brackets (for example "DE · master · stem"). Programme rows show logo + programme + university; institution rows now **link** to `/institutions/[id]` (closes a known gap). Eight rows per group, then "and {n} more" / "and {n} more matching the same rule".
- Application: deadline rows (or the raw deadline text), "Apply now" (external), "Sourced from {provider}" with last-verified date, "Official source" link when different. Track this application is available here too.
- More like this: `FundingPoster` rail, same coverage or country.

### 9.5 University page — `/institutions/[id]`

- Banner: cover photo (or scene), logo 72, H1 name, flag + full country name + city, "Founded {year}" with `Calendar` when known, type pill. Right: "Website" outline pill (external). Photo credit as in §9.3.
- Facts: Programmes (count), Linked scholarships (count), ROR identifier linked to its ror.org record.
- "Programmes you match here": `MatchPosterCard` rail sorted by the user's score (hidden without a profile). Then "All programmes": rows (logo-free, since it's the same university) with name, field, duration, degree badge; 40 rows then "and {n} more".
- "Scholarships": the two existing groups, compact `FundingPoster` grid; 40 across both then "and {n} more matching the same rules".

### 9.6 Catalogues — `/programs`, `/scholarships`, `/institutions`

Shared Browse layout:

- Light top bar on desktop; on phones the Explore segmented control (Programmes | Scholarships | Universities) under the header.
- Header: H1 ("Programmes", "Scholarships", "Universities") + result sentence (15px ink-3): default "Showing 25–48 of 1,412 programmes"; with `qualify=1`: "312 match your profile, out of 1,412".
- Search: 48px input, radius 999, `Search` icon, visually hidden label "Search programmes or universities" (per catalogue). Debounce 300ms, then `router.replace` with `scroll: false` inside `startTransition`; a visually hidden `aria-live` line says "Searching…" while pending and "{n} results" when done. This closes the "request per keystroke" gap. `?focus=search` autofocuses the input.
- Filter chips (wrap): each existing select becomes a chip that opens a Base UI Popover or Select with the same options and URL key. Active chips show their value ("Country: Germany") in blue tint with an `X` to clear. New chip "I qualify" (`qualify=1`, signed-in users with a profile only): shows only matches that are not Missing requirement. "Clear all" text button when any filter is active. Sort stays a select on the right with today's options.
- View toggle for programmes and scholarships: Posters (default) | List (`view=list`).
- **Posters view (Phase 4a)**: grid `repeat(auto-fill, minmax(240px, 1fr))`, gap 20. Programmes use `MatchPosterCard` in fluid mode; scholarships use `FundingPoster` in fluid mode. 24 per page as today (12 with data saver, MAY).
- **List view (Phase 4b, MAY)**: rows (radius 16, hairline, padding `14px 16px`, gap 16): logo 52, title link (16px 700), flag + city + university (14px ink-3), facts inline with icons (tuition, length, closes), `ScoreDial` 46 light, `SaveButton` outline. At ≥ 1280px: list (`flex: 999 1 560px`) beside a sticky preview pane (`flex: 1 1 400px`, top 96px) showing the selected item: cover 200px, logo, title, dial 60 + strength, top 3 reasons, 2×2 facts, "Open programme page", "Add to compare". Each row has a "Preview" icon button (44px, `aria-label="Preview {title}"`); the title link still navigates.
- **Universities catalogue**: cards with logo 52, name, flag + full country name + city, type, counts (programmes, scholarships). Keep its filters (country with counts, show, sort).
- Pagination: keep the numbered `Pagination` component (restyle: 44px pills, current Kick Blue). Delete the unused `Pager` from `main` (closes the duplicate-component gap).
- Empty state: today's sentence in British spelling ("No programmes match your filters yet.") plus a "Clear filters" button.
- **Compare (Phase 4c)**: `CompareTray` appears when at least one item is added: fixed at the bottom (above the mobile tab bar), night background, radius 20, `raised` shadow, max-width 960 centred, padding `14px 18px`: label "Compare", up to 3 chips (logo 32 + title + remove `X`), an empty slot "Add one more", primary "Compare {n}" → `/compare?type=program&ids=…`. State in a React context backed by `localStorage` key `ks-compare-program` (wrapped in try/catch). `/compare` renders a table: one column per item (logo, title, university, dial, strength) and rows Tuition, Length, Starts, Next deadline, Taught in, Linked funding, Requirements met/missing, Location. First column sticky; horizontal scroll on phones.

### 9.7 My plan — `/plan`

- Header: H1 "My plan", subline "Everything you've saved and the applications you're tracking.", tabs "Applications ({n})" | "Saved ({n})" (Base UI Tabs bound to `?tab=`; default Applications if any exist, else Saved).
- **Saved tab**: groups "Programmes" and "Scholarships" (sentence-case H2), poster grids (fluid `MatchPosterCard` / `FundingPoster`). Under each card an outline "Track application" button, which becomes a "Tracking" link to the Applications tab once tracked. Empty: "Nothing saved yet. Browse programmes or scholarships and tap the bookmark to save them here." with both links.
- **Applications tab**: keep the six columns and their order (see open question 6 about the first column's name). Column headings sentence case with counts: "Planning (2)". Cards: logo 40 + title link; countdown chip (red when ≤ 14 days); document checklist (checkbox + label; checked items in ink-3, no strike-through); "Add document" input + button (disabled until text is typed); toolbar with labelled buttons "Move back", "Move forward", "Mark rejected". Accepted and Rejected cards get a "Move back" action (closes the "mistaken rejection can't be undone" gap). Moving stays button-based (no drag and drop).
- New applications MUST get a seeded checklist from the opportunity's document requirements, when any exist, without duplicates (in the existing create-application action).
- Phones: columns stack as sections.
- MAY: a slim progress strip in the header (Profile → Discover → Fund → Apply → Go), reusing the old StudyAbroad Journey logic.

### 9.8 Profile — `/profile`

- Light shell, H1 "Your profile", completeness as a 60px ring styled like `ScoreDial` + "{n} of 8 details added".
- Section cards with ids: `#personal`, `#academic`, `#preferences`, `#language`, `#experience` (deep-link targets for the unlock card).
- **Nationality**: searchable select (Base UI Combobox or Select with search) of countries. Before changing the input, check how the matching engine compares nationality. Store exactly the canonical format the matcher expects; if stored values are inconsistent today, write a one-off normalisation script and ask Jarvis before running it on production. This closes the "Nigeria vs nigerian" gap.
- **Budget currency**: select of ISO 4217 codes (EUR default, GBP, USD, SEK, NOK, DKK, CHF, NGN).
- **Field-level errors** (closes a gap): map server validation issues to fields; show red text with `CircleAlert` under the field; `aria-invalid="true"` and `aria-describedby`; focus the first invalid field after a failed save.
- Country pills: keep the 10 targets, add flags.
- Desired fields tag input: same behaviour, chips restyled in blue tint.
- Save: keep "Save profile" / "Saving…" and "Saved — {n} programme matches and {n} scholarship matches updated."
- MAY: Data saver switch here as well as in the avatar menu.

### 9.9 Eligibility report — `/eligibility`

Restyle with the new components, same content order: two score tiles (`ScoreDial` 88 for "Your strongest opportunities", plain number for the catalogue average), strength counts as `StrengthBadge`s with counts, `ScoreBreakdown`, blockers (ink heading with red icon, rows with logo links), actions (Kick Blue icon), strongest matches list with logos and dials. "Browse all" target: see open question 7.

### 9.10 Auth — `/login`, `/signup`

Keep layout and behaviour. Apply tokens and fonts; inputs 48px, radius 12, visible focus ring; buttons as pills. Replace the photo slideshow with a night panel showing the `nordic` scene and the line "Find the programmes and scholarships you actually qualify for." (MAY; at minimum restyle). Password reset and email verification are out of scope (§18).

### 9.11 Landing — `/` (Phase 7)

- Rebuild the hero in the billboard style: night background, scene illustration on the right, headline on the left in one colour (no single-word accents), mock match card clearly labelled "Illustrative example".
- Signed-out "Programmes" and "Scholarships" links go to `/signup?next=/programs` (or `/scholarships`) with the copy "Create a free account to browse".
- Footer: hide entries without pages (About, Contact, Eligibility guides, Study destinations) until they exist. Privacy and Terms SHOULD exist before public launch: flag for Jarvis rather than writing legal text.
- Keep the WebGL particles but make sure they stay off for reduced motion, under 640px, and with data saver on.

### 9.12 Admin

- Light shell. Tabs mark the current page (`aria-current="page"`, Kick Blue underline) (closes a gap).
- Headings sentence case.
- Verification queue: "Reject" opens a Base UI AlertDialog: "Reject this scholarship? It will leave the queue." Buttons "Reject" (destructive) and "Cancel" (closes a gap).
- Data quality: add a "Media coverage" group in Phase 6: Institutions with logo, With cover photo, With neither.

---

## 10. Data the UI needs

### 10.1 Principle

Each page has one server-side loader that returns plain serialisable props. No client fetching for the first render. Select only the needed columns, include institution data in the same query (no N+1), and use `React.cache` for per-request memoisation.

### 10.2 Card data types

Names below are illustrative. Map them to the real models during Phase 0 and record the mapping in the recon doc. Put shared types in `lib/types/cards.ts`.

```ts
export type Strength =
  | "STRONG_MATCH" | "LIKELY_ELIGIBLE" | "POTENTIAL_MATCH" | "NEEDS_VERIFICATION" | "MISSING_REQUIREMENT";

export type InstitutionFace = {
  id: string;
  name: string;
  acronym: string | null;
  countryCode: string | null;   // ISO 3166-1 alpha-2
  city: string | null;
  logoUrl: string | null;
  cover: {
    url: string; width: number; height: number;
    color: string | null; credit: string | null; license: string | null; sourceUrl: string | null;
  } | null;
};

export type MatchInfo = { score: number; strength: Strength; verified: boolean };

export type Reason = { text: string; met: boolean };

export type ProgrammeCardData = {
  id: string;
  title: string;
  degree: string | null;
  durationMonths: number | null;
  institution: InstitutionFace;
  tuition: { kind: "free" | "amount" | "varies" | "unknown"; amount?: number; currency?: string; per?: "year" | "total" };
  bestFunding: { label: string; positive: boolean } | null;   // "Full tuition scholarship"
  nextDeadline: { date: string; type?: string | null } | null; // ISO date
  match: MatchInfo | null;
  reasons: Reason[];   // ≤ 3, for previews
  saved: boolean;
};

export type Coverage =
  | "FULL_FUNDING" | "FULL_TUITION" | "PARTIAL_TUITION" | "VARIES" | "STIPEND" | "TRAVEL" | "UNKNOWN";

export type ScholarshipCardData = {
  id: string;
  title: string;
  provider: { name: string; institution: InstitutionFace | null };
  coverage: Coverage;
  amount: { value: number; currency: string; per?: "month" | "year" | "once" | "total" } | null;
  percentOfTuition: number | null;
  sourceVerified: boolean;
  nextDeadline: { date: string } | null;
  deadlineText: string | null;
  match: MatchInfo | null;
  saved: boolean;
};

export type HomeFeed = {
  firstName: string | null;
  hasProfile: boolean;
  previousVisitAt: string | null;
  featured: (ProgrammeCardData & { basis: string | null; fundingLine: string | null; deadlineLine: string })[]; // ≤ 3
  unlock: { title: string; body: string; primary: { label: string; href: string }; secondary?: { label: string; href: string } } | null;
  applications: ApplicationSummary[];    // ≤ 3
  strongMatches: ProgrammeCardData[];    // ≤ 20
  strongMatchesTotal: number;
  newStrongCount: number;
  closingSoon: DeadlineItem[];           // ≤ 12
  funding: ScholarshipCardData[];        // ≤ 20
  fundingTotal: number;
  oneAway: OneAwayItem[];                // ≤ 10
  destinations: { countryCode: string; count: number }[]; // ≤ 10
};
```

`ApplicationSummary`, `DeadlineItem` and `OneAwayItem` follow the fields listed in §9.1.3 and §9.1.6.

Loader: `lib/home/get-home-feed.ts`. One query per rail at most.

### 10.3 "New since your last visit"

- Add `homeLastVisitedAt` (nullable timestamp) to the user record, or an equivalent activity table, with a migration.
- On render, read the previous value `P` and count strong matches whose underlying programme was first ingested after `P`. Use the programme's creation timestamp only if ingestion keeps it stable across re-crawls; otherwise add a `firstSeenAt` column filled by ingestion (ask Jarvis before touching ingestion).
- Update `homeLastVisitedAt` **after** render via a small client effect that calls a server action, so a refresh doesn't zero the count before the user sees it.
- Label: "since Friday" (weekday of `P` in Africa/Lagos) when `P` is within 7 days, else "since 2 Nov". `P` null → no pill.

### 10.4 Projected score for "One requirement away"

- If the matching module exposes a pure scoring function, add `projectScore(match, blocker)` that re-scores with that one requirement treated as met. Compute only for up to 30 candidates per request; cache per user per profile version.
- If that isn't possible without changing scoring internals, don't show numbers. Show the card without the "rises" line. Never estimate.

### 10.5 Next steps derivation (detail pages)

1. One step per blocker for this match, with the action link from §14.4.
2. One step per document-type requirement: "Prepare your {document}".
3. Final step: "Submit on the university site by {2 Jan}" (or "on the provider's site"); no date → "Submit on the official site".

When tracking, these steps map one-to-one to the application's checklist (seeded on track).

### 10.6 Destination counts

Group the user's matches that are not Missing requirement by `institution.countryCode`.

---

## 11. Media pipeline: logos and campus photos (Phase 6; may start right after Phase 1)

Goal: as many institutions as possible get a real logo and a decent cover photo, cached on our storage, with licence information kept.

### 11.1 Schema additions (institution)

Translate to the project's ORM:

```
logoUrl          string?    our storage URL (square WebP)
logoSource       string?    'wikidata' | 'logo.dev' | 'brandfetch' | 'manual'
logoCheckedAt    datetime?
coverUrl         string?    our storage URL (16:9 WebP, largest variant)
coverWidth       int?
coverHeight      int?
coverColor       string?    #RRGGBB average colour, used as the loading background
coverCredit      string?    author text, HTML stripped
coverLicense     string?    e.g. "CC BY-SA 4.0"
coverLicenseUrl  string?
coverSourceUrl   string?    Commons file page
coverCheckedAt   datetime?
wikidataId       string?    from ROR external_ids
domain           string?    from ROR, if not already stored
acronym          string?    from ROR names (type "acronym")
mediaLocked      boolean    default false; the pipeline never overwrites locked rows
```

### 11.2 Sources, in order

1. **ROR** (institutions already carry ROR ids): `GET https://api.ror.org/v2/organizations/{id}` → `domains`, `links` (type website), `external_ids` (type wikidata), `names` (type acronym). Use API v2 (v1 is retired). ROR data is CC0. ROR asks frequent API users to register a client id.
2. **Wikidata**: `GET https://www.wikidata.org/wiki/Special:EntityData/{Qid}.json` → claims `P154` (logo image), `P18` (image), `P856` (official website). Values are Commons file names.
3. **Wikimedia Commons**: `GET https://commons.wikimedia.org/w/api.php?action=query&format=json&titles=File:{name}&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=1600` → `thumburl`, `extmetadata.Artist`, `LicenseShortName`, `LicenseUrl`.
4. **Logo fallback by domain**: Logo.dev (`https://img.logo.dev/{domain}?token=…`, env `LOGO_DEV_TOKEN`) or Brandfetch. The old Clearbit Logo API shut down in December 2025; don't use it. Read the chosen provider's current docs and terms (attribution, caching, rate limits) before enabling it.

Wikimedia etiquette (required by their policy): send a descriptive `User-Agent` with contact details, for example `KickScholarMediaBot/1.0 (https://<site>; <contact email>)`; stay at or under 2 requests per second; back off on 429 and 5xx and respect `Retry-After`.

### 11.3 Processing (sharp)

- **Logos**: rasterise SVG sources (never store or serve third-party SVG as-is: script risk). Trim transparent or white borders, fit inside 256×256 with 12% padding on a transparent background, output WebP at 128 and 256.
- **Covers**: reject when the mime type isn't JPEG/PNG/WebP, width < 800, aspect ratio < 1.2 (portrait), or the file name/description matches `/(logo|seal|coat of arms|crest|map|locator|signature|flag|emblem|diagram)/i`. Crop to 16:9 with sharp's attention strategy, output WebP at 640, 1280 and 1920 widths (quality about 70), and compute the average colour (resize to 1×1).
- Upload through `lib/media/store.ts` (`put(key, buffer, contentType) → url`): the project's existing storage if any, otherwise an S3-compatible adapter (env vars); local-disk adapter for development (`public/media/`, gitignored). Add the storage host to `images.remotePatterns`.

### 11.4 Script

`scripts/enrich-institution-media.ts` with flags `--limit`, `--country`, `--only-missing`, `--dry-run`, `--force`. Resumable: skip rows checked within 30 days unless `--force`; always skip `mediaLocked`. Writes `tmp/media-report-{date}.csv` (id, name, logo result and source, cover result, rejection reason). Run first for the 10 target countries with `--limit 50` and share the report.

### 11.5 Licensing and use

- Show `coverCredit` and licence on detail banners, linked to `coverSourceUrl`.
- Add a `/credits` page listing every cover image in use with author, licence and source (SHOULD). Ask Jarvis to confirm the attribution approach before launch; don't treat this brief as legal advice.
- University logos are their owners' trademarks. Use them only to identify the institution next to its name; never recolour, crop or alter them (scaling and padding only).

### 11.6 Admin (MAY)

"Media coverage" tiles (§9.12) and a per-institution override: upload a logo or cover, set credit and licence, lock.

---

## 12. Data saver and performance

### 12.1 Data saver

- State: cookie `ks_ds` (`1` or `0`) so the server renders the right markup. If there is no cookie and the request has `Save-Data: on`, treat it as on. On the client, if there is no cookie and `navigator.connection?.saveData` is true, set the cookie to `1` and refresh.
- Switch in the avatar menu (and MAY on Profile). After toggling, refresh the route.
- When on: `CoverImage` renders tints everywhere (billboard, posters, banners, destination tiles); detail banners offer a "Show photo" button for that one page; logos still load (small, cached); Home shows the banner from §9.1.7; catalogue page size MAY drop to 12.

### 12.2 Images

- `next/image` for every cover and logo. `images.formats: ["image/avif", "image/webp"]`.
- `sizes`: poster `"(min-width: 768px) 272px, 236px"`; grid poster `"(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 100vw"`; billboard `"(min-width: 768px) 74vw, 100vw"`; detail banner `"(min-width: 768px) 70vw, 100vw"`; destination tile `"220px"`; logos at their pixel size.
- `priority` only on the billboard and the detail banner.

### 12.3 Budgets (Lighthouse mobile, simulated slow 4G)

| Page | LCP | CLS | TBT | First-load transfer |
| --- | --- | --- | --- | --- |
| Home | ≤ 2.5s | ≤ 0.05 | ≤ 200ms | ≤ 900 KB, ≤ 450 KB with data saver |
| Programme page | ≤ 2.5s | ≤ 0.05 | ≤ 200ms | ≤ 700 KB |
| Catalogue | ≤ 2.5s | ≤ 0.05 | ≤ 200ms | ≤ 800 KB |

- No new client dependency over 15 KB gzipped without Jarvis's approval.
- Two variable font families, Latin subset, `display: swap`.
- Rails, hover previews and tickets are CSS plus small client islands; no carousel library.

### 12.4 Caching

Per-user match data is dynamic. Shared programme, scholarship and institution details MAY be cached per id with the project's existing caching approach; never cache user-specific data across users.

---

## 13. Accessibility (WCAG 2.2 AA)

- Text colours only from §5.2. Kick Green is never text under 24px.
- Colour is never the only signal: strength = dial colour + number + word; deadlines = red + clock icon + words; requirement status = icon + words.
- Every interactive target is at least 44×44px (icon buttons keep a 44px hit area even when the visible disc is 36px).
- Visible focus everywhere: 3px `--focus` outline, 2px offset, including inside rails and on night surfaces.
- Keyboard: Tab reaches every card link in rails; previews open on focus-within; prev/next and pager buttons work; Escape closes menus and popovers; no traps.
- Semantics: one H1 per page; sections labelled by their headings; rails are lists; icon-only toggles use `aria-pressed` with a constant label, buttons whose visible text changes don't also use `aria-pressed`; live regions for search status and billboard changes; form errors linked with `aria-describedby`.
- Covers, logos, scenes and flags are decorative (`alt=""` / `aria-hidden`), because the name is always printed beside them.
- `lang="en-GB"`.
- At 320px width and 200% zoom: no horizontal page scroll (rails scroll inside themselves).
- Run axe (for example `@axe-core/playwright`) on Home, programme page, scholarship page, catalogue, My plan and Profile: zero serious or critical violations.

---

## 14. Copy guide

### 14.1 Voice

Plain, direct, encouraging, never hype. Sentence case. British spelling. Buttons say what happens: "Track this application", "Add test score", "See why you match", "Apply on the university site". No exclamation marks except the existing "Accepted!" milestone.

### 14.2 Formats

| Thing | Format |
| --- | --- |
| Dates | "2 Jan 2027"; current year "2 Jan"; tickets "Sun 22 Nov". Countdowns computed in Africa/Lagos |
| Countdown | "Closes in 53 days", "Closes tomorrow", "Closes today"; tickets "53 days left", "1 day left", "Today" |
| Money | `Intl` en-GB; symbols for EUR, GBP, USD, NGN; codes for SEK, NOK, DKK, CHF ("SEK 12,000"); free tuition is "No tuition fees" |
| Scores | Dial number, or "92%" in text; strength words exactly as §6.4 |
| Counts | Thousands separators: "1,412"; singular/plural: "1 programme", "2 programmes" |
| Durations | Whole years when divisible by 12 ("2 years, full-time"); otherwise months ("18 months") |

### 14.3 Trust copy (keep verbatim)

- Programme funding, officially linked: "Named directly by the scholarship provider."
- Programme funding, may apply: "Matched from each scholarship's own stated rules — not confirmed by the provider. Check before applying."
- Programme funding, university-wide group heading: "Open across {university}" (as today).
- Scholarship "where", officially linked: "Named directly by the source."
- Scholarship "where", may apply: "Worked out from this scholarship's own stated rules" … "not confirmed by the provider. Check with the institution before applying."
- Unverified scholarship notice keeps "a starting point, not confirmed fact".
- Source badge labels change to "Verified source" / "Needs verification" (tooltip keeps the longer explanation, §6.5).

### 14.4 Blocker → copy templates

Map the eligibility engine's blocker taxonomy onto these. Fallback for anything unmapped: title "{n} opportunities need: {blocker label}", button "Review profile" → `/profile`.

| Blocker | Unlock card title | Primary button → link | One-away / next-step action |
| --- | --- | --- | --- |
| English test missing | "{n} more programmes open up when you add an English test score" | "Add test score" → `/profile#language` | "Add test score" |
| English score too low | "{n} programmes ask for a higher English score than yours" | "Update test score" → `/profile#language` | "Update test score" |
| CGPA missing | "Add your CGPA to see {n} more matches" | "Add CGPA" → `/profile#academic` | "Add CGPA" |
| CGPA below minimum | No unlock card (nothing to fix quickly) | — | No action button; text only |
| Budget below living costs | "{n} more open up with funding for living costs" | "See living-cost funding" → `/scholarships?coverage=STIPEND` | "Find living-cost funding" |
| Work experience short | "{n} scholarships need more work experience" | "Update experience" → `/profile#experience` | "Update experience" |
| Preferences missing | "Add preferred countries to sharpen your matches" | "Add countries" → `/profile#preferences` | — |
| Nationality or degree level not eligible | Never shown as an unlock | — | — |

Unlock body copy for the English-test case: "Add your IELTS or TOEFL result. Some programmes accept a letter from your university confirming your degree was taught in English instead."

### 14.5 Short reason templates (billboard and previews)

| Factor | Met | Gap |
| --- | --- | --- |
| Degree/field | "Your {BSc in Computer Science} is a direct fit" / preview "{Field} degree fits" | "Needs a degree in {field}" |
| Grades | "Your {3.72} CGPA clears the entry bar" / "CGPA clears the entry bar" | "Needs a CGPA of {x}" |
| Tuition | "No tuition fees at this public university" / "No tuition fees" | — |
| Funding | "{Scholarship} applies to this programme" | — |
| Nationality | "Open to {Nigerian} applicants" | — |
| English | "Your {IELTS 7.0} meets the requirement" | "Needs {IELTS 6.5}" (add ", or a letter showing your degree was taught in English" only if the requirement data says such letters are accepted) |

---

## 15. Known gaps this remodel closes

| Known gap (UI reference) | Resolution | Phase |
| --- | --- | --- |
| No loading screens | `loading.tsx` skeletons | 1 |
| No custom error / 404 pages | `error.tsx`, `not-found.tsx` | 1 |
| Every tab titled "KickScholar" | Route metadata | 1 |
| Brand spec vs shipped palette | `FRONTEND.md` updated to shipped palette + Night | 1 |
| Catalogue search fires per keystroke | 300ms debounce + transition | 4 |
| Two pagination components | Delete unused `Pager` | 4 |
| Institutions dead end; raw country codes | Links from programme/scholarship pages; `countryName()` everywhere | 3, 4 |
| Applications only startable from Saved | "Track this application" on detail pages | 3 |
| Accepted/Rejected can't be undone | "Move back" on final cards | 5 |
| Profile errors not shown per field | Inline field errors | 5 |
| Nationality and currency free text | Selects, matcher-compatible values | 5 |
| Admin current tab not shown | `aria-current` + underline | 7 |
| Admin Reject has no confirmation | AlertDialog | 7 |
| Landing links need sign-in; dead footer items | Sign-up redirects; hide dead items | 7 |
| No password reset / email verification | Out of scope (§18) | — |
| Dark theme never activated | Out of scope; night zones only | — |

---

## 16. Phases, tasks and gates

Every phase: small commits (conventional commit messages), typecheck, lint, existing tests and production build MUST pass at the gate. At each gate, STOP and report: what changed, screenshots (from `/dev/kit` or the real pages at 390 and 1440 wide), any data gaps found, open questions.

### Phase 0 — Recon (no code changes)

- [ ] Read the codebase: layouts, `app/globals.css`, `app/layout.tsx`, `components/ui/`, `Mono`, `Pagination`, `Pager`, dashboard, programme/scholarship/institution pages, saved, applications, profile, eligibility, admin, data access layer, strength helper, server actions (save, track, move, documents), schema/ORM, tests and tooling.
- [ ] Confirm Tailwind version, ORM, Next.js version (and whether `Atkinson_Hyperlegible_Next` is available in `next/font/google`), test setup (unit, e2e).
- [ ] Map every field in §10.2 to the real models; list what's missing.
- [ ] Write `docs/ui-remodel-recon.md`: file map, field mapping, data gaps, risks, answers needed for §4.2.
- **Gate**: summarise the recon doc and wait. Create `feat/ui-remodel` only after Jarvis confirms the base branch.

### Phase 1 — Foundations

- [ ] Tokens (§5.1) and Tailwind mapping; shadcn token remap; `FRONTEND.md` updated.
- [ ] Fonts (§5.3); `lang="en-GB"`; `Mono` re-implemented; old font loaders removed when unused.
- [ ] Utilities: `monogram.ts`, `country.ts`, `format.ts`, `strength.ts`, `coverage.ts` with unit tests.
- [ ] Components: `InstitutionLogo`, `CountryFlag`, `CoverImage` (scenes from Appendix A in `public/scenes/`), `ScoreDial`, badges, `SaveButton`, `SectionHeading`, `Rail`.
- [ ] App shell: `TopNav` (night/light), `MobileHeader`, `TabBar`, `AvatarMenu`; sidebar and drawer removed. "My plan" points to `/applications` until Phase 5.
- [ ] `DataSaverProvider` and switch.
- [ ] Page metadata; `loading.tsx`, `error.tsx`, `not-found.tsx`.
- [ ] `/dev/kit` page with fixtures (Appendix C).
- **Gate**: checks pass; `/dev/kit` screenshots at 390 and 1440; existing pages still work with the new shell and type.

### Phase 2 — Home

- [ ] `getHomeFeed` and types; `homeLastVisitedAt` migration and post-render update.
- [ ] `Billboard`, `FeaturedCarousel`, `UnlockCard`, `ApplicationProgressCard`, `MatchPosterCard` (with preview), `DeadlineTicket`, `FundingPoster`, `OneAwayCard`, `DestinationTile`, data saver banner.
- [ ] Home assembly for desktop and mobile; no-profile hero; edge states; profile section ids.
- [ ] `projectScore` if feasible (§10.4); otherwise cards without numbers.
- [ ] Unit tests for feed selection rules: caps, ordering, Missing requirement excluded, 45-day window, ≤ 14 days red, "new" counting.
- **Gate**: Home with real data for a seeded test user; screenshots at 390, 768, 1024, 1440 with data saver off and on; axe clean; Lighthouse numbers vs §12.3. Compare against `docs/ui-remodel/home-reference.png`.

### Phase 3 — Detail pages

- [ ] Programme page (§9.3), scholarship page (§9.4), university page (§9.5).
- [ ] Track from detail pages with seeded checklists; Share; institution links; More like this.
- [ ] Old tab URLs redirect to section anchors.
- **Gate**: deep links work (`#why`, `#funding`…); tracking creates an application with a checklist; screenshots; axe clean.

### Phase 4 — Browse

- [ ] 4a: header, debounced search, filter chips with URL keys, `qualify=1`, posters view, universities cards with full country names, `Pager` deleted.
- [ ] 4b (MAY): list view and preview pane.
- [ ] 4c (MAY): compare tray and `/compare`.
- **Gate**: old catalogue URLs still filter identically (write a test with a few real query strings); one request per pause in typing, not per keystroke; screenshots.

### Phase 5 — My plan, profile, eligibility

- [ ] `/plan` with tabs; redirects from `/saved` and `/applications`; `revalidatePath` calls updated.
- [ ] Board restyle; "Move back" on final cards; seeded checklists confirmed.
- [ ] Profile: section ids (if not done), nationality and currency selects (matcher-compatible), inline field errors, flags on country pills.
- [ ] Eligibility restyle.
- **Gate**: save, track, move, add/tick documents all still work; tests pass; screenshots.

### Phase 6 — Media pipeline (may run in parallel after Phase 1)

- [ ] Schema fields and migration.
- [ ] `lib/media/store.ts` adapters; `images.remotePatterns`.
- [ ] `scripts/enrich-institution-media.ts` (§11.4).
- [ ] Credits on banners; `/credits` page (SHOULD); admin media coverage tiles (MAY).
- [ ] Optional `/api/calendar/deadlines.ics` for saved and tracked deadlines (MAY), then show "Add deadlines to calendar" on Home.
- **Gate**: run for the 10 target countries with `--limit 50`; share the CSV report and 20 random results for Jarvis to review.

### Phase 7 — Landing, auth, admin polish

- [ ] Landing hero and links (§9.11); auth restyle (§9.10); admin tabs, headings and Reject confirmation (§9.12).
- **Gate**: screenshots; axe clean.

### Phase 8 — QA and release

- [ ] Run everything in §17 and fix what fails.
- [ ] CHANGELOG entry; PR description with before/after screenshots per screen and width.
- **Gate**: Jarvis approves the PR.

---

## 17. Testing and QA checklist

- **Unit**: `monogramText`, `hash32` colour stability, strength accent mapping, countdown and date formatting (Africa/Lagos, today/tomorrow edges), money formatting (EUR, SEK, NGN), coverage → label and band colour, amount font sizing, blocker → copy template, home feed selection rules.
- **End-to-end** (Playwright if present; otherwise add a minimal setup and ask first): sign in as a seeded user → Home shows rails; save toggles and persists; track from a programme page creates an application with a checklist; catalogue filters and debounce; data saver hides images; keyboard-only pass through Home.
- **Visual**: screenshots at 360, 390, 768, 1024, 1280, 1440 for Home, programme page, scholarship page, university page, programmes catalogue, My plan, Profile.
- **Accessibility**: axe with zero serious/critical issues; a manual screen-reader smoke test (NVDA or VoiceOver) on Home and a programme page.
- **Performance**: Lighthouse mobile budgets (§12.3).
- **Content sweeps** (grep): no "Programs" in UI strings (route paths excepted), no uppercase label classes in student pages, no emoji, no fixture data imported outside `/dev/kit` and tests.
- **Regression**: admin pages load and act; login, sign-up, sign-out; all server actions.

---

## 18. Out of scope (later)

- Deadline reminders by email or WhatsApp (the strongest retention lever after this remodel; the UI leaves room for "Remind me" actions but MUST NOT show them until they work).
- Password reset and email verification.
- Full dark theme.
- Public, signed-out catalogue pages for search engines.
- Shareable match images (Open Graph images for "I'm a 92% match…").
- "Because you saved X" rail (needs a similarity model).
- Notification centre and bell.
- Weekly digest email.

---

## Appendix A — Scene SVGs

Save each as `public/scenes/{name}.svg`. They're original flat illustrations used when no campus photo exists. Use them with `object-fit: cover; object-position: center bottom`.

### A.1 `nordic.svg`

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" preserveAspectRatio="xMidYMax slice">
<rect width="320" height="180" fill="#10304F"/>
<path d="M-20 76C30 46 80 94 140 62S250 30 340 60V76C260 52 200 94 140 80S40 72 -20 98Z" fill="#3FB59A" opacity="0.42"/>
<path d="M-20 54C50 30 110 68 180 44S280 26 340 42V50C280 38 220 64 176 58S60 46 -20 68Z" fill="#9BE3CF" opacity="0.3"/>
<circle cx="262" cy="30" r="8" fill="#EAF1F7"/>
<g fill="#EAF1F7"><circle cx="36" cy="22" r="1.3"/><circle cx="92" cy="36" r="1"/><circle cx="208" cy="18" r="1.3"/><circle cx="300" cy="70" r="1"/><circle cx="150" cy="24" r="1"/></g>
<path d="M0 148L8 130L16 148L22 122L30 148L38 134L46 148L54 118L62 148L70 132L78 148H244L252 130L260 148L268 120L276 148L284 132L292 148L300 122L308 148L316 134L320 148V180H0Z" fill="#183F63"/>
<g fill="#0A223A"><rect x="116" y="116" width="88" height="40"/><rect x="146" y="94" width="28" height="22"/><path d="M144 95A16 16 0 0 1 176 95Z"/><rect x="158" y="70" width="4" height="12"/><rect x="118" y="104" width="12" height="12"/><path d="M118 105A6 6 0 0 1 130 105Z"/><rect x="190" y="104" width="12" height="12"/><path d="M190 105A6 6 0 0 1 202 105Z"/><path d="M136 117L160 104L184 117Z"/><rect x="106" y="156" width="108" height="6"/></g>
<g fill="#1F4A70"><rect x="140" y="122" width="3" height="30"/><rect x="149" y="122" width="3" height="30"/><rect x="158" y="122" width="3" height="30"/><rect x="167" y="122" width="3" height="30"/><rect x="176" y="122" width="3" height="30"/></g>
<g fill="#F2C46D"><rect x="122" y="126" width="5" height="7"/><rect x="193" y="126" width="5" height="7"/><rect x="122" y="140" width="5" height="7"/><rect x="193" y="140" width="5" height="7"/></g>
<rect y="160" width="320" height="20" fill="#081B2E"/>
<path d="M0 180V156L10 136L20 156L28 142L38 162L46 150L56 180Z" fill="#06172A"/>
<path d="M320 180V154L310 134L300 154L292 140L282 160L274 148L264 180Z" fill="#06172A"/>
</svg>
```

### A.2 `canal.svg`

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" preserveAspectRatio="xMidYMax slice">
<rect width="320" height="180" fill="#F1CDAE"/>
<circle cx="236" cy="60" r="20" fill="#EE8F5E"/>
<rect x="28" y="30" width="72" height="5" rx="2.5" fill="#F7DFCB"/>
<rect x="190" y="20" width="96" height="5" rx="2.5" fill="#F7DFCB"/>
<path d="M6 126V84H12V78H18V72H32V78H38V84H44V126Z" fill="#A54A33"/>
<path d="M44 126V72L62 56L80 72V126Z" fill="#6B3326"/>
<path d="M80 126V80H86V74H92V68H106V74H112V80H118V126Z" fill="#C8763F"/>
<path d="M118 126V64C118 54 128 48 136 48C144 48 154 54 154 64V126Z" fill="#4C2921"/>
<path d="M154 126V78H160V72H166V66H180V72H186V78H192V126Z" fill="#B65A3B"/>
<path d="M192 126V68L210 52L228 68V126Z" fill="#7A3A2B"/>
<path d="M228 126V82H234V76H240V70H254V76H260V82H266V126Z" fill="#D58A52"/>
<path d="M266 126V62L288 46L310 62V126Z" fill="#5A2D24"/>
<path d="M310 126V80H320V126Z" fill="#A54A33"/>
<g fill="#F8E6D2"><rect x="14" y="92" width="6" height="9"/><rect x="30" y="92" width="6" height="9"/><rect x="14" y="108" width="6" height="9"/><rect x="30" y="108" width="6" height="9"/><rect x="54" y="84" width="6" height="9"/><rect x="66" y="84" width="6" height="9"/><rect x="54" y="102" width="6" height="9"/><rect x="66" y="102" width="6" height="9"/><rect x="88" y="88" width="6" height="9"/><rect x="104" y="88" width="6" height="9"/><rect x="88" y="106" width="6" height="9"/><rect x="104" y="106" width="6" height="9"/><rect x="128" y="70" width="6" height="9"/><rect x="140" y="70" width="6" height="9"/><rect x="128" y="90" width="6" height="9"/><rect x="140" y="90" width="6" height="9"/><rect x="128" y="108" width="6" height="9"/><rect x="140" y="108" width="6" height="9"/><rect x="162" y="86" width="6" height="9"/><rect x="178" y="86" width="6" height="9"/><rect x="162" y="106" width="6" height="9"/><rect x="178" y="106" width="6" height="9"/><rect x="202" y="80" width="6" height="9"/><rect x="214" y="80" width="6" height="9"/><rect x="202" y="100" width="6" height="9"/><rect x="214" y="100" width="6" height="9"/><rect x="236" y="90" width="6" height="9"/><rect x="252" y="90" width="6" height="9"/><rect x="236" y="108" width="6" height="9"/><rect x="252" y="108" width="6" height="9"/><rect x="278" y="74" width="6" height="9"/><rect x="294" y="74" width="6" height="9"/><rect x="278" y="94" width="6" height="9"/><rect x="294" y="94" width="6" height="9"/><rect x="278" y="112" width="6" height="9"/><rect x="294" y="112" width="6" height="9"/></g>
<rect y="126" width="320" height="6" fill="#2A2A33"/>
<rect y="132" width="320" height="48" fill="#36627F"/>
<g fill="#5D8CAA"><rect x="14" y="140" width="34" height="2" rx="1"/><rect x="90" y="146" width="48" height="2" rx="1"/><rect x="186" y="140" width="40" height="2" rx="1"/><rect x="250" y="150" width="46" height="2" rx="1"/><rect x="40" y="160" width="60" height="2" rx="1"/><rect x="210" y="166" width="52" height="2" rx="1"/></g>
<path d="M112 156H168L160 165H120Z" fill="#1F2A37"/>
<rect x="130" y="149" width="18" height="7" rx="1" fill="#1F2A37"/>
</svg>
```

### A.3 `gothic.svg`

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" preserveAspectRatio="xMidYMax slice">
<rect width="320" height="180" fill="#CCD6E4"/>
<rect x="36" y="30" width="84" height="4" rx="2" fill="#DDE5EF"/>
<rect x="214" y="44" width="70" height="4" rx="2" fill="#DDE5EF"/>
<path d="M0 134V104H18V92H30V104H48V96L58 78L68 96V104H92V134Z" fill="#9AA7BD"/>
<path d="M228 134V100H244V88L252 70L260 88V100H284V94H300V100H320V134Z" fill="#9AA7BD"/>
<path d="M96 152V96H112V70L124 38L136 70V96H184V70L196 38L208 70V96H224V152Z" fill="#3B4763"/>
<path d="M136 97L160 80L184 97Z" fill="#3B4763"/>
<circle cx="160" cy="114" r="11" fill="#CCD6E4"/>
<circle cx="160" cy="114" r="5" fill="#3B4763"/>
<g fill="#252F47"><path d="M151 152V136A9 9 0 0 1 169 136V152Z"/><path d="M119 96V84A5 5 0 0 1 129 84V96Z"/><path d="M191 96V84A5 5 0 0 1 201 84V96Z"/><path d="M104 140V124A4 4 0 0 1 112 124V140Z"/><path d="M208 140V124A4 4 0 0 1 216 124V140Z"/></g>
<circle cx="70" cy="142" r="16" fill="#5B7A66"/>
<circle cx="250" cy="144" r="14" fill="#5B7A66"/>
<circle cx="274" cy="148" r="12" fill="#4B6957"/>
<rect y="152" width="320" height="28" fill="#2B3448"/>
<rect y="162" width="320" height="2" fill="#3E4A62"/>
</svg>
```

### A.4 `modern.svg`

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" preserveAspectRatio="xMidYMax slice">
<rect width="320" height="180" fill="#D9E6EF"/>
<circle cx="268" cy="40" r="14" fill="#F4F8FB"/>
<path d="M0 148V106H28V94H58V148Z" fill="#AFC3D3"/>
<path d="M262 148V98H290V110H320V148Z" fill="#AFC3D3"/>
<rect x="86" y="60" width="124" height="88" fill="#2E5B82"/>
<g fill="#4C7DA8"><rect x="98" y="60" width="2" height="88"/><rect x="116" y="60" width="2" height="88"/><rect x="134" y="60" width="2" height="88"/><rect x="152" y="60" width="2" height="88"/><rect x="170" y="60" width="2" height="88"/><rect x="188" y="60" width="2" height="88"/><rect x="86" y="76" width="124" height="2"/><rect x="86" y="94" width="124" height="2"/><rect x="86" y="112" width="124" height="2"/><rect x="86" y="130" width="124" height="2"/></g>
<rect x="210" y="92" width="54" height="56" fill="#1F4466"/>
<rect x="218" y="102" width="38" height="6" fill="#F2C46D" opacity="0.9"/>
<rect x="218" y="116" width="38" height="6" fill="#7FA6C7"/>
<rect x="218" y="130" width="38" height="6" fill="#F2C46D" opacity="0.9"/>
<path d="M44 148V40M44 44H122M44 44L56 32L56 44M104 44V60" stroke="#1F4466" stroke-width="2" fill="none"/>
<circle cx="70" cy="146" r="12" fill="#3F7F5C"/>
<circle cx="278" cy="144" r="14" fill="#4E8F6A"/>
<circle cx="298" cy="150" r="10" fill="#3F7F5C"/>
<rect y="148" width="320" height="32" fill="#B9C6D0"/>
<rect y="160" width="320" height="4" fill="#A3B2BE"/>
</svg>
```

### A.5 `harbour.svg`

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180" preserveAspectRatio="xMidYMax slice">
<rect width="320" height="180" fill="#BFD7E3"/>
<path d="M0 102L40 72L90 98L140 62L200 94L250 58L320 92V132H0Z" fill="#A7C2B6"/>
<path d="M0 120L60 64L104 96L150 50L214 104L262 76L320 114V132H0Z" fill="#7E9F92"/>
<rect x="24" y="106" width="26" height="26" fill="#B83B2E"/><path d="M22 107L37 94L52 107Z" fill="#2B2F36"/>
<rect x="54" y="102" width="26" height="30" fill="#E3A23A"/><path d="M52 103L67 90L82 103Z" fill="#2B2F36"/>
<rect x="84" y="108" width="26" height="24" fill="#F2EEE4"/><path d="M82 109L97 96L112 109Z" fill="#2B2F36"/>
<rect x="114" y="100" width="26" height="32" fill="#3C6C99"/><path d="M112 101L127 88L142 101Z" fill="#2B2F36"/>
<rect x="144" y="104" width="26" height="28" fill="#C2563A"/><path d="M142 105L157 92L172 105Z" fill="#2B2F36"/>
<rect x="174" y="106" width="26" height="26" fill="#F2EEE4"/><path d="M172 107L187 94L202 107Z" fill="#2B2F36"/>
<rect x="204" y="102" width="26" height="30" fill="#D98B3A"/><path d="M202 103L217 90L232 103Z" fill="#2B2F36"/>
<rect x="234" y="108" width="26" height="24" fill="#8E2F27"/><path d="M232 109L247 96L262 109Z" fill="#2B2F36"/>
<rect x="264" y="104" width="26" height="28" fill="#3C6C99"/><path d="M262 105L277 92L292 105Z" fill="#2B2F36"/>
<g fill="#F7EEDC"><rect x="30" y="114" width="5" height="6"/><rect x="39" y="114" width="5" height="6"/><rect x="60" y="110" width="5" height="6"/><rect x="69" y="110" width="5" height="6"/><rect x="120" y="108" width="5" height="6"/><rect x="129" y="108" width="5" height="6"/><rect x="150" y="112" width="5" height="6"/><rect x="159" y="112" width="5" height="6"/><rect x="210" y="110" width="5" height="6"/><rect x="219" y="110" width="5" height="6"/><rect x="240" y="116" width="5" height="6"/><rect x="249" y="116" width="5" height="6"/><rect x="270" y="112" width="5" height="6"/><rect x="279" y="112" width="5" height="6"/></g>
<g fill="#3C4652"><rect x="90" y="116" width="5" height="6"/><rect x="99" y="116" width="5" height="6"/><rect x="180" y="114" width="5" height="6"/><rect x="189" y="114" width="5" height="6"/></g>
<rect y="130" width="320" height="4" fill="#26313B"/>
<rect y="134" width="320" height="46" fill="#2C5D7A"/>
<g fill="#4F7F9B"><rect x="20" y="144" width="40" height="2" rx="1"/><rect x="100" y="152" width="56" height="2" rx="1"/><rect x="190" y="142" width="36" height="2" rx="1"/><rect x="40" y="166" width="48" height="2" rx="1"/><rect x="270" y="160" width="40" height="2" rx="1"/></g>
<path d="M236 160V126M254 160V132" stroke="#26313B" stroke-width="1.5" fill="none"/>
<path d="M224 160H266L258 169H232Z" fill="#26313B"/>
</svg>
```

### A.6 Rosette ornament (funding posters)

Inline it (it inherits `stroke` from the parent and should be `aria-hidden`):

```svg
<svg aria-hidden="true" width="240" height="240" viewBox="0 0 240 240" fill="none" stroke="#FFFFFF" stroke-width="1" style="position:absolute;right:-78px;top:-70px;opacity:.16">
<ellipse cx="120" cy="120" rx="112" ry="40"/>
<ellipse cx="120" cy="120" rx="112" ry="40" transform="rotate(30 120 120)"/>
<ellipse cx="120" cy="120" rx="112" ry="40" transform="rotate(60 120 120)"/>
<ellipse cx="120" cy="120" rx="112" ry="40" transform="rotate(90 120 120)"/>
<ellipse cx="120" cy="120" rx="112" ry="40" transform="rotate(120 120 120)"/>
<ellipse cx="120" cy="120" rx="112" ry="40" transform="rotate(150 120 120)"/>
<circle cx="120" cy="120" r="28"/>
</svg>
```

---

## Appendix B — Country → scene and tint

| Country | Code | Scenes (pick by `hash32(institutionId)`) | Tint |
| --- | --- | --- | --- |
| Finland | FI | nordic | `#10304F` |
| Sweden | SE | harbour, nordic | `#2C5D7A` |
| Norway | NO | harbour | `#2C5D7A` |
| Denmark | DK | harbour, canal | `#2C5D7A` |
| Germany | DE | modern, gothic | `#2E5B82` |
| Netherlands | NL | canal | `#A54A33` |
| Belgium | BE | gothic, canal | `#3B4763` |
| France | FR | gothic | `#3B4763` |
| Ireland | IE | harbour, gothic | `#2C5D7A` |
| United Kingdom | GB | gothic, modern | `#3B4763` |
| Anything else | — | modern, gothic | `#3A4A5E` |

Destination tiles always use the first scene listed for the country.

---

## Appendix C — Fixtures for `/dev/kit` and tests

Sample content only (it's what the canvas mockup used). Never import it outside `/dev/kit` and tests. Adapt field names to the final types; keep it in `fixtures/home-feed.sample.ts`.

```ts
export const sampleFeatured = [
  { id: "uh-cs", title: "MSc in Computer Science", inst: { name: "University of Helsinki", countryCode: "FI", city: "Helsinki" },
    score: 92, strength: "STRONG_MATCH", basis: "7 of 8 checks met",
    reasons: [
      { text: "Your BSc in Computer Science is a direct fit", met: true },
      { text: "Your 3.72 CGPA clears the entry bar", met: true },
      { text: "Needs IELTS 6.5, or a letter showing your degree was taught in English", met: false } ],
    fundingLine: "University scholarship can cover full tuition", deadlineLine: "Applications close 2 Jan, in 53 days" },
  { id: "rwth-ds", title: "MSc in Data Science", inst: { name: "RWTH Aachen University", acronym: "RWTH", countryCode: "DE", city: "Aachen" },
    score: 88, strength: "STRONG_MATCH", basis: "6 of 7 checks met",
    reasons: [
      { text: "No tuition fees at this public university", met: true },
      { text: "Your maths and statistics courses meet the prerequisites", met: true },
      { text: "Needs IELTS 6.5 before you apply", met: false } ],
    fundingLine: "No tuition, small semester fee", deadlineLine: "Applications close 1 Mar, in 111 days" },
  { id: "tud-set", title: "MSc in Sustainable Energy Technology", inst: { name: "Delft University of Technology", countryCode: "NL", city: "Delft" },
    score: 86, strength: "STRONG_MATCH", basis: "6 of 7 checks met",
    reasons: [
      { text: "Your CGPA meets the grade threshold", met: true },
      { text: "Holland Scholarship applies to this programme", met: true },
      { text: "Needs IELTS 6.5 with 6.0 in each part", met: false } ],
    fundingLine: "Holland Scholarship: €5,000 in year one", deadlineLine: "Applications close 15 Jan, in 66 days" },
];

export const sampleUnlock = {
  title: "23 more programmes open up when you add an English test score",
  body: "Add your IELTS or TOEFL result. Some programmes accept a letter from your university confirming your degree was taught in English instead.",
  primary: { label: "Add test score", href: "/profile#language" },
  secondary: { label: "Upload a letter", href: "/profile#language" },
};

export const sampleApplications = [
  { title: "MSc in Computer Science", org: "University of Helsinki", stage: "IN_PROGRESS", done: 3, total: 5, due: "2027-01-02", next: "Book an IELTS date" },
  { title: "Scholarships for Global Professionals", org: "Swedish Institute", stage: "PLANNING", done: 1, total: 6, due: null, dueText: "Opens in December", next: "Note your leadership roles" },
  { title: "MSc in Data Science", org: "RWTH Aachen University", stage: "PLANNING", done: 1, total: 4, due: "2027-03-01", next: "Check the uni-assist steps" },
];

export const sampleStrongMatches = [
  { id: "uh-cs", title: "MSc in Computer Science", inst: "University of Helsinki", cc: "FI", city: "Helsinki", score: 92, funding: "Full tuition scholarship", positive: true, months: 24, deadline: "2027-01-02",
    reasons: ["BSc Computer Science fits", "CGPA clears the entry bar", "!Needs IELTS 6.5"] },
  { id: "rwth-ds", title: "MSc in Data Science", inst: "RWTH Aachen University", cc: "DE", city: "Aachen", score: 88, funding: "No tuition fees", positive: true, months: 24, deadline: "2027-03-01",
    reasons: ["No tuition fees", "Maths prerequisites met", "!Needs IELTS 6.5"] },
  { id: "lund-ml", title: "MSc in Machine Learning", inst: "Lund University", cc: "SE", city: "Lund", score: 84, funding: "Swedish Institute funding", positive: true, months: 24, deadline: "2027-01-15",
    reasons: ["Field and degree fit", "Swedish Institute funding", "!Needs IELTS 6.5"] },
  { id: "ucd-se", title: "MSc in Software Engineering", inst: "University College Dublin", cc: "IE", city: "Dublin", score: 81, funding: "Partial scholarship", positive: false, months: 12, deadline: "2027-03-31",
    reasons: ["Degree fits the course", "Open to all nationalities", "!Needs IELTS 6.5"] },
  { id: "kul-ai", title: "MSc in Artificial Intelligence", inst: "KU Leuven", cc: "BE", city: "Leuven", score: 78, funding: "Master Mind scholarship", positive: true, months: 12, deadline: "2027-03-01",
    reasons: ["Field and degree fit", "Scholarship may apply", "!Needs IELTS 7.0"] },
  { id: "rug-cs", title: "MSc in Computing Science", inst: "University of Groningen", cc: "NL", city: "Groningen", score: 76, funding: "Holland Scholarship", positive: true, months: 24, deadline: "2027-05-01",
    reasons: ["Degree fits the course", "Holland Scholarship applies", "!Needs IELTS 6.5"] },
]; // reasons starting with "!" are gaps

export const sampleClosingSoon = [
  { title: "MSc in Environmental Science", org: "Ghent University", deadline: "2026-11-22" },
  { title: "Erasmus Mundus Master in Big Data Management", org: "Erasmus Mundus consortium", deadline: "2026-11-29" },
  { title: "MSc in Public Health", org: "Uppsala University", deadline: "2026-12-05" },
  { title: "MSc in Petroleum Geoscience", org: "University of Bergen", deadline: "2026-12-11" },
  { title: "MSc in Computer Science", org: "University of Helsinki", deadline: "2027-01-02" },
]; // with "today" = 2026-11-10 these are 12, 19, 25, 31 and 53 days away

export const sampleFunding = [
  { title: "University of Helsinki Scholarship", provider: "University of Helsinki", coverage: "FULL_TUITION", percentOfTuition: 100, per: "of tuition, every year", verified: true, due: "Closes 2 Jan" },
  { title: "Erasmus Mundus Joint Masters scholarship", provider: "European Commission", coverage: "FULL_FUNDING", amount: { value: 1400, currency: "EUR", per: "month" }, per: "a month, plus tuition and travel", verified: true, due: "Varies by course" },
  { title: "Scholarships for Global Professionals", provider: "Swedish Institute", coverage: "FULL_FUNDING", amount: { value: 12000, currency: "SEK", per: "month" }, per: "a month, plus tuition", verified: true, due: "Opens in December" },
  { title: "Holland Scholarship", provider: "Dutch Ministry of Education with universities", coverage: "VARIES", amount: { value: 5000, currency: "EUR", per: "once" }, per: "paid in your first year", verified: true, due: "Closes 1 Feb" },
  { title: "Master Mind Scholarships", provider: "Flemish Government", coverage: "UNKNOWN", amount: null, per: "found on a third-party site", verified: false, due: "Check with provider" },
];

export const sampleOneAway = [
  { title: "MSc in Embedded Systems", org: "Eindhoven University of Technology", gap: "Needs IELTS 6.5 with at least 6.0 in each part. You have not added a test yet.", from: 66, to: 87, action: "Add test score" },
  { title: "MSc in Computer Science", org: "Saarland University", gap: "Your living-cost budget is below what a German student visa asks you to show.", from: 61, to: 83, action: "Find living-cost funding" },
  { title: "DAAD EPOS scholarship", org: "German Academic Exchange Service", gap: "Needs 2 years of work experience. You have 14 months.", from: 58, to: 90, action: "Update experience" },
];

export const sampleDestinations = [
  { countryCode: "DE", count: 38 }, { countryCode: "NL", count: 21 }, { countryCode: "SE", count: 17 },
  { countryCode: "FI", count: 14 }, { countryCode: "BE", count: 12 }, { countryCode: "IE", count: 9 },
];
```

---

## Appendix D — Prompts for Claude Code

Paste one at a time. Wait for each gate.

**Phase 0**
> Read `docs/ui-remodel.md` in full. Do Phase 0 only: explore the codebase without changing code, then write `docs/ui-remodel-recon.md` as §16 describes (file map, field mapping for §10.2, data gaps, risks, and the §4.2 questions you still need answered). Summarise the findings and stop.

**Phase 1**
> Implement Phase 1 of `docs/ui-remodel.md` on branch `feat/ui-remodel`. Follow §5–§8 exactly, using the recon doc for file locations. Commit in small steps. Run typecheck, lint, tests and a production build. Stop at the gate and report with screenshots of `/dev/kit` at 390 and 1440 wide.

**Phase 2**
> Implement Phase 2 (Home) of `docs/ui-remodel.md`. Match `docs/ui-remodel/home-reference.png` for desktop and §9.1.8 for mobile. Data rules in §9.1 and §10 are requirements, not suggestions; if data is missing, hide the element and log it in `docs/ui-remodel-data-gaps.md`. Stop at the gate with screenshots at 390, 768, 1024 and 1440, data saver off and on, plus axe and Lighthouse results.

**Phase 3**
> Implement Phase 3 (programme, scholarship and university pages) of `docs/ui-remodel.md` (§9.3–§9.5). Keep the trust copy in §14.3 verbatim. Stop at the gate.

**Phase 4**
> Implement Phase 4a of `docs/ui-remodel.md` (§9.6). Keep every existing catalogue URL working and add a test proving it. Ask before starting 4b or 4c.

**Phase 5**
> Implement Phase 5 of `docs/ui-remodel.md` (§9.7–§9.9). Before changing how nationality is stored or entered, show me how the matcher reads it and propose the change. Stop at the gate.

**Phase 6**
> Implement Phase 6 of `docs/ui-remodel.md` (§11). Use the storage I named in the open questions. Run the script for the 10 target countries with `--limit 50`, then show me the CSV report and 20 random results.

**Phase 7 and 8**
> Implement Phase 7 of `docs/ui-remodel.md`, then run the full §17 checklist as Phase 8. Fix what fails and prepare the PR description with before/after screenshots.

---

## References

- ROR API documentation: https://ror.readme.io
- Wikimedia User-Agent policy: https://meta.wikimedia.org/wiki/User-Agent_policy
- Wikidata properties: P154 (logo image), P18 (image), P856 (official website)
- Clearbit Logo API shutdown and Logo.dev migration: https://www.logo.dev/clearbit
- `flag-icons`: https://github.com/lipis/flag-icons
- Atkinson Hyperlegible Next: https://github.com/googlefonts/atkinson-hyperlegible-next
