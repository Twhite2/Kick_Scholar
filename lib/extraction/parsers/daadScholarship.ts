import type { ExtractionFile } from "../schemas";
import type { SourceDocumentInput } from "../types";
import type { ParserResult, SourceParser } from "./types";

/**
 * Deterministic parser for DAAD scholarship-database detail pages
 * (www2.daad.de/.../21148-scholarship-database/?detail=<id>).
 *
 * These pages are strongly fielded — every one carries the same `### `
 * sections (Target Group, Academic Requirements, Duration, Scholarship
 * Value, Application Deadline, …) under an `## ` programme title — so the
 * *structure* is fully deterministic. The *values* inside those sections are
 * prose ("1 to 3 months", two different EUR tiers in one bullet list), which
 * is why this parser extracts and quotes them verbatim but leaves genuinely
 * interpretive fields (eligibility enums, a single headline amount) for the
 * LLM stage, reported via `coverage.unfilled`.
 *
 * Nothing here is inferred. A section that is absent yields null, and every
 * value carries the exact source text it came from.
 */

/**
 * DAAD publishes these pages under two distinct templates, split roughly
 * 87/60 across the 149-page corpus, which use different names for the same
 * section. Measured heading frequencies across every crawled detail page:
 *
 *   Template A                      Template B
 *   Target Group          (87)      Who can apply?                 (60)
 *   Scholarship Value     (86)      Value                          (60)
 *   Duration              (86)      Duration of the funding        (54)
 *   Academic Requirements (81)      What requirements must be met? (38)
 *   Programme Description (88)      Objective                      (63)
 *
 * Aliases are listed in descending frequency; the first present wins.
 */
const SECTION = {
  description: ["Programme Description", "Objective"],
  targetGroup: ["Target Group", "Who can apply?"],
  academicRequirements: ["Academic Requirements", "What requirements must be met?"],
  duration: ["Duration", "Duration of the funding"],
  value: ["Scholarship Value", "Value", "What can be funded?"],
  deadline: ["Application Deadline", "Application deadline"],
  language: ["Language skills", "Language requirements"],
} as const;

/**
 * DAAD renders a cookie-consent block above the real content on every page.
 * It is boilerplate, identical across pages, and would otherwise dominate
 * both the quote-matching surface and the LLM token count.
 */
function stripCookieBanner(markdown: string): string {
  const start = markdown.search(/^##\s+\S/m);
  return start > 0 ? markdown.slice(start) : markdown;
}

/** Splits markdown into `heading -> body` using ## and ### headings. */
function sectionize(markdown: string): Map<string, string> {
  const sections = new Map<string, string>();
  const parts = markdown.split(/^(#{2,3}\s+.*)$/m);
  for (let i = 1; i < parts.length; i += 2) {
    const heading = parts[i].replace(/^#+\s*/, "").trim();
    const body = (parts[i + 1] ?? "").trim();
    // Some pages repeat a heading (DAAD has two "Contact" and both an
    // "Application requirements" and "Application Requirements"). Keep the
    // first non-empty occurrence rather than letting a later empty one win.
    const key = heading.toLowerCase();
    if (!sections.has(key) || !sections.get(key)) sections.set(key, body);
  }
  return sections;
}

/** Collapses markdown bullets/whitespace into a quotable single-line string. */
function flatten(text: string): string {
  return text
    .replace(/^\s*[*-]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

function firstSentence(text: string, max = 400): string {
  const flat = flatten(text);
  return flat.length <= max ? flat : `${flat.slice(0, max).trimEnd()}…`;
}

export class DaadScholarshipParser implements SourceParser {
  readonly sourceId = "src-daad";

  matches(doc: SourceDocumentInput): boolean {
    return (
      doc.url.includes("21148-scholarship-database") && doc.url.includes("detail=")
    );
  }

  parse(doc: SourceDocumentInput): ParserResult | null {
    const body = stripCookieBanner(doc.markdown);

    // The programme title is the first `## ` heading after the banner.
    const titleMatch = body.match(/^##\s+(.+)$/m);
    if (!titleMatch) return null;
    const name = titleMatch[1].replace(/\s*_?\+?_?\s*$/, "").trim();
    if (!name) return null;

    const sections = sectionize(body);
    /** First non-empty section among the template aliases for a field. */
    const get = (headings: readonly string[]): string | null => {
      for (const heading of headings) {
        const v = sections.get(heading.toLowerCase());
        if (v && v.length > 0) return v;
      }
      return null;
    };

    const filled: string[] = [];
    const unfilled: string[] = [];
    const warnings: string[] = [];

    const descriptionRaw = get(SECTION.description);
    const targetGroupRaw = get(SECTION.targetGroup);
    const academicRaw = get(SECTION.academicRequirements);
    const durationRaw = get(SECTION.duration);
    const valueRaw = get(SECTION.value);
    const deadlineRaw = get(SECTION.deadline);
    const languageRaw = get(SECTION.language);

    for (const [label, raw] of [
      ["target group", targetGroupRaw],
      ["award value", valueRaw],
      ["application deadline", deadlineRaw],
    ] as const) {
      if (!raw) {
        warnings.push(
          `no ${label} section found under any known heading alias — possible new DAAD template`,
        );
      }
    }

    // Language requirements are stated only in template B. When present they
    // are a real, quotable eligibility signal rather than something to infer.
    if (languageRaw) unfilled.push("scholarships[0].eligibility[].LANGUAGE");

    // coverageType: only the unambiguous case is claimed. A recurring
    // monthly figure is a stipend by definition; anything else stays UNKNOWN,
    // which the schema treats as a first-class value rather than a gap.
    const valueFlat = valueRaw ? flatten(valueRaw) : "";
    const isMonthlyStipend = /\b(per month|each month|monthly)\b/i.test(valueFlat);
    const coverageType = isMonthlyStipend ? "STIPEND" : "UNKNOWN";
    if (isMonthlyStipend) filled.push("scholarships[0].coverageType");
    else unfilled.push("scholarships[0].coverageType");

    // amount is deliberately NOT parsed. These pages routinely quote several
    // tiers in one section ("1,300 EUR" for graduates, "1,600 EUR" for
    // post-docs, plus a "500 EUR" travel allowance) and picking one would
    // fabricate a headline figure the page never states.
    if (valueRaw) unfilled.push("scholarships[0].amount");

    // The deadline is very often prose ("Application deadlines differ and may
    // be requested at the individual institutions"), never a parseable date.
    // Storing it as deadlineText honours the schema rule against inventing a
    // date from vague text.
    if (deadlineRaw) filled.push("scholarships[0].deadlineText");

    // Eligibility is stated as prose and needs enum interpretation.
    if (targetGroupRaw) unfilled.push("scholarships[0].eligibility[].DEGREE_LEVEL");
    if (academicRaw) unfilled.push("scholarships[0].eligibility[].MIN_GPA|OTHER");
    unfilled.push("scholarships[0].applicability");

    filled.push(
      "scholarships[0].name",
      "scholarships[0].providerName",
      "scholarships[0].country",
      "scholarships[0].applicationUrl",
      "scholarships[0].sourceUrl",
    );
    if (descriptionRaw) filled.push("scholarships[0].description");
    if (durationRaw) filled.push("scholarships[0].description(duration)");

    // Description: prefer the programme description, else the target group.
    const description = descriptionRaw
      ? firstSentence(descriptionRaw, 1500)
      : targetGroupRaw
        ? firstSentence(targetGroupRaw, 1500)
        : null;

    // Every record needs a verbatim quote. Use the most identity-bearing
    // sentence available, falling back to the title line itself.
    const sourceQuote = targetGroupRaw
      ? firstSentence(targetGroupRaw)
      : descriptionRaw
        ? firstSentence(descriptionRaw)
        : name;

    const extraction: ExtractionFile = {
      sourceId: this.sourceId,
      sourceDocumentId: doc.sourceDocumentId,
      extractedBy: "manual",
      extractedAt: new Date().toISOString(),
      universities: [],
      programs: [],
      scholarships: [
        {
          name,
          providerName: "DAAD (German Academic Exchange Service)",
          providerType: "NATIONAL_EDUCATION_PORTAL",
          country: "DE",
          amount: null,
          amountCurrency: null,
          coverageType,
          description,
          applicationUrl: doc.url,
          deadlineText: deadlineRaw ? firstSentence(deadlineRaw) : null,
          isRenewable: null,
          discoveredFrom: null,
          discoveryUrl: null,
          officialSourceUrl: null,
          sourceUrl: doc.url,
          sourceQuote,
          eligibility: [],
          // Left to the LLM stage — the page states these as prose.
          applicability: [],
          deadlines: [],
        },
      ],
    };

    // The substantive sections, for the LLM stage — see ParserResult.focusText.
    const focusParts: string[] = [];
    for (const [heading, body] of [
      ["Programme Description", descriptionRaw],
      ["Target Group", targetGroupRaw],
      ["Academic Requirements", academicRaw],
      ["Duration", durationRaw],
      ["Scholarship Value", valueRaw],
      ["Application Deadline", deadlineRaw],
      ["Language skills", languageRaw],
    ] as const) {
      if (body) focusParts.push(`### ${heading}\n${body}`);
    }

    return {
      extraction,
      coverage: { filled, unfilled, warnings },
      focusText: focusParts.join("\n\n"),
    };
  }
}

export const daadScholarshipParser = new DaadScholarshipParser();
