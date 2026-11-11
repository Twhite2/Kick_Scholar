/**
 * The headline amount of a scholarship, as the page states it.
 *
 * Students compare scholarships by what they pay out, which on almost every
 * source is a monthly stipend ("A monthly payment of 992 euros", "at the
 * rate of £1,347 per month", "Master's: 9.500 TL"). Only an amount the page
 * states with its currency is returned; amounts that describe something
 * else (prizes, project costs, rent, earnings from jobs, proof of funds) are
 * ignored rather than mistaken for the award.
 */

export type AmountPeriod = "MONTH" | "YEAR" | "ONCE" | "TOTAL";

export interface StatedAmount {
  amount: number;
  currency: string;
  period: AmountPeriod | null;
  /** The phrase it came from, for the extraction file's audit trail. */
  quote: string;
}

const CURRENCY: Array<[RegExp, string]> = [
  [/^(?:euros?|eur|€)$/i, "EUR"],
  [/^(?:£|gbp|pounds?(?: sterling)?)$/i, "GBP"],
  [/^(?:\$|usd|us dollars?)$/i, "USD"],
  [/^(?:tl|try|lira|turkish lira)$/i, "TRY"],
  [/^(?:yen|jpy|¥)$/i, "JPY"],
  [/^(?:chf|swiss francs?)$/i, "CHF"],
  [/^(?:sek)$/i, "SEK"],
];

function currencyOf(token: string): string | null {
  const t = token.trim();
  for (const [re, code] of CURRENCY) if (re.test(t)) return code;
  return null;
}

/** "1,300" "1.200,00" "9.500" "144,000" "1347" -> number. */
export function parseNumber(raw: string): number | null {
  const s = raw.trim().replace(/\s/g, "");
  let n: number;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) n = Number(s.replace(/\./g, "").replace(",", "."));
  else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) n = Number(s.replace(/,/g, ""));
  else if (/^\d+,\d{1,2}$/.test(s)) n = Number(s.replace(",", "."));
  else n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const NUM = String.raw`\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?`;
const CUR_AFTER = String.raw`euros?|EUR|GBP|pounds?|USD|TL|TRY|lira|yen|JPY|CHF|SEK`;
const CUR_BEFORE = String.raw`€|£|\$|¥`;
const MONEY = new RegExp(String.raw`(?:(${CUR_BEFORE})\s?(${NUM}))|(?:(${NUM})\s?(${CUR_AFTER}|€)\b)`, "gi");

/** Context that means the figure is not the award itself. */
const NOT_THE_AWARD =
  /prize|winner|earn|wage|part-time|job|rent\b|dormitor|accommodation costs|proof of|cash funds|at least|outreach|pledged|research allowance|project|travel|insurance|child allowance|family|accompanying|arrival allowance|host organisation|tuition fees? (?:of|up to)|up to a maximum|limited to|exchange rate|per hour|application fee|deposit|contribut|co-funded|exceed|average|approx|living costs?|cost of living/i;

const PERIODS: Array<[AmountPeriod, RegExp]> = [
  ["MONTH", /per month|a month|monthly|each month|\/\s?month|per mensem/gi],
  ["YEAR", /per year|a year|annual|per annum|each year|\/\s?year/gi],
  ["ONCE", /one-off|one-time|once|lump sum|single payment/gi],
  ["TOTAL", /in total|total of|overall/gi],
];

/** ", " ";" "and" "or" "plus": where one figure's clause ends and the next begins. */
const CLAUSE = /,\s|;|\band\b|\bor\b|\bplus\b|\bas well as\b/gi;

/**
 * The period named closest to the figure, within its own clause: in "a
 * monthly payment of 992 euros and a one-off allowance of 460 euros" the 992
 * is monthly and the 460 one-off.
 */
function periodOf(beforeAll: string, afterAll: string): AmountPeriod | null {
  let cut = 0;
  for (const m of beforeAll.matchAll(CLAUSE)) cut = (m.index ?? 0) + m[0].length;
  const before = beforeAll.slice(cut);
  const end = afterAll.search(new RegExp(CLAUSE.source, "i"));
  const after = end < 0 ? afterAll : afterAll.slice(0, end);
  let best: { period: AmountPeriod; distance: number } | null = null;
  for (const [period, re] of PERIODS) {
    for (const m of before.matchAll(re)) {
      const distance = before.length - ((m.index ?? 0) + m[0].length);
      if (!best || distance < best.distance) best = { period, distance };
    }
    for (const m of after.matchAll(re)) {
      const distance = m.index ?? 0;
      if (!best || distance < best.distance) best = { period, distance };
    }
  }
  return best?.period ?? null;
}

const BULLET = /^([*\-•+])\s+/;

/**
 * The text as list items and paragraphs. A tier list is often split over
 * lines under one bullet ("* Monthly payments of\n2,000 euros for …\n2,150
 * euros for professors", or sub-items with a different marker), so lines run
 * on until a blank line or the next bullet of the same kind. Table rows are
 * dropped: on these pages they compare costs (rent, fees), not awards.
 */
function itemsOf(text: string): string[] {
  const out: string[] = [];
  let marker: string | null = null;
  let open = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("|") || line.startsWith("#")) {
      open = false;
      continue;
    }
    const m = line.match(BULLET);
    const body = m ? line.slice(m[0].length) : line;
    if (m && (marker === null || m[1] === marker)) {
      marker = m[1];
      out.push(body);
      open = true;
    } else if (open) {
      out[out.length - 1] += ` ${body}`;
    } else {
      out.push(body);
      open = true;
    }
  }
  return out;
}

/**
 * The stipend a student would receive, preferring a monthly amount.
 *
 * Returns null when the page lists several rates for the same period
 * ("1,300 EUR for graduates, 1,600 EUR for post-docs", "£1,347 per month,
 * or £1,652 in London", "Master's: 9.500 TL, PhD: 12.500 TL"): no single
 * figure is true for every recipient, so picking one would state something
 * the page does not. A one-off payment beside a monthly stipend is not a
 * rival rate.
 */
export function parseScholarshipAmount(text: string): StatedAmount | null {
  const candidates: Array<StatedAmount & { score: number; index: number; item: number }> = [];
  const items = itemsOf(text);
  items.forEach((t, item) => {
    for (const m of t.matchAll(MONEY)) {
      const currency = currencyOf(m[1] ?? m[4] ?? "");
      const amount = parseNumber(m[2] ?? m[3] ?? "");
      if (!currency || amount === null) continue;
      const at = m.index ?? 0;
      const before = t.slice(Math.max(0, at - 70), at);
      const after = t.slice(at + m[0].length, at + m[0].length + 50);
      if (NOT_THE_AWARD.test(before.slice(-45)) || NOT_THE_AWARD.test(after.slice(0, 25))) continue;
      // Amounts written as "4" or "15" with a currency are usually percentages or counts gone wrong.
      if (amount < 50) continue;
      const period = periodOf(before, after) ?? (/stipend|allowance|scholarship payments?|instalment/i.test(before) ? "MONTH" : null);
      let score = 0;
      if (period === "MONTH") score += 4;
      if (/stipend|allowance|scholarship|payment|instalment|grant|benefit/i.test(before)) score += 2;
      if (/master|graduate|postgraduate/i.test(before.slice(-25))) score += 2;
      if (/undergraduate|bachelor|associate|doctoral|phd|professor|post-?doc/i.test(before.slice(-25))) score -= 1;
      candidates.push({ amount, currency, period, quote: t.length > 240 ? `${t.slice(0, 237)}…` : t, score, index: candidates.length, item });
    }
  });
  // A bare figure with no award context is not trusted.
  const award = candidates.filter((c) => c.score >= 2);
  if (award.length === 0) return null;
  award.sort((a, b) => b.score - a.score || a.index - b.index);
  const best = award[0];
  // Another rate for the same period, or any other figure in the same item
  // ("1.400 euros for doctoral candidates, 2.000 euros for professors").
  const rival = candidates.some(
    (c) =>
      c !== best &&
      c.amount !== best.amount &&
      c.currency === best.currency &&
      (c.item === best.item ? c.period === best.period || c.period === null : c.score >= 2 && c.period === best.period),
  );
  if (rival) return null;
  return { amount: best.amount, currency: best.currency, period: best.period, quote: best.quote };
}

/** The text of a markdown section, e.g. DAAD's "### Value". */
export function sectionText(markdown: string, heading: RegExp, maxLines = 25): string | null {
  const lines = markdown.split(/\r?\n/);
  const i = lines.findIndex((l) => /^#{2,4}\s/.test(l) && heading.test(l.replace(/^#+\s*/, "")));
  if (i < 0) return null;
  const out: string[] = [];
  for (let j = i + 1; j < Math.min(lines.length, i + 1 + maxLines); j++) {
    if (/^#{2,4}\s/.test(lines[j])) break;
    out.push(lines[j]);
  }
  return out.join("\n").trim() || null;
}
