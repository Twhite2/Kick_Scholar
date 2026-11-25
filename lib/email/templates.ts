import { SITE_URL } from "@/lib/site";
import { countryName } from "@/lib/ui/country";
import { degreeLabel } from "@/lib/ui/requirements";

/**
 * VarsityFind's emails, in the site's look: the logo on a Night band, a
 * white card on the paper background, Varsity Blue pill buttons and mint
 * accents. Built from tables with inline styles, because that is what email
 * clients (Gmail, Outlook) reliably render; Bricolage Grotesque loads where
 * a client allows web fonts and falls back to Helvetica/Arial elsewhere.
 */

const C = {
  night: "#071D33",
  paper: "#F3F5F8",
  white: "#FFFFFF",
  ink: "#0E1B2A",
  ink2: "#2B3A4B",
  ink3: "#546477",
  line: "#E4E9EF",
  blue: "#0B4F8C",
  mint: "#6FD39B",
  greenText: "#1F7A4D",
};
const DISPLAY = "'Bricolage Grotesque', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const BODY = "'Atkinson Hyperlegible Next', 'Helvetica Neue', Helvetica, Arial, sans-serif";

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export interface TemplateOptions {
  /** The site address links point to. */
  siteUrl?: string;
  /** Where the logo image is loaded from (the live site; a local folder for previews). */
  assetBase?: string;
}

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function button(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 8px;">
  <tr><td style="border-radius:999px;background:${C.blue};">
    <a href="${href}" style="display:inline-block;padding:15px 30px;border-radius:999px;font-family:${BODY};font-size:16px;font-weight:700;line-height:1;color:${C.white};text-decoration:none;">${escapeHtml(label)}</a>
  </td></tr>
</table>`;
}

function paragraph(html: string): string {
  return `<p style="margin:0 0 16px;font-family:${BODY};font-size:16px;line-height:1.6;color:${C.ink2};">${html}</p>`;
}

function layout(o: {
  preheader: string;
  heading: string;
  body: string;
  footer: string;
  siteUrl: string;
  assetBase: string;
}): string {
  const host = new URL(o.siteUrl).host.replace(/^www\./, "");
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(o.heading)}</title>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Atkinson+Hyperlegible+Next:wght@400;700&display=swap" rel="stylesheet">
<style>
  @media (max-width: 620px) {
    .vf-card { padding: 28px 22px !important; }
    .vf-band { padding: 24px 22px !important; }
    .vf-h1 { font-size: 24px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${C.paper};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.paper};">${escapeHtml(o.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.paper};">
  <tr><td align="center" style="padding:32px 12px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
      <tr><td class="vf-band" style="background:${C.night};border-radius:20px 20px 0 0;padding:28px 36px 24px;">
        <a href="${o.siteUrl}/" style="text-decoration:none;"><img src="${o.assetBase}/email/varsityfind-logo-reversed.png" width="180" height="27" alt="VarsityFind" style="display:block;border:0;width:180px;height:auto;color:${C.white};font-family:${DISPLAY};font-size:22px;font-weight:800;"></a>
        <div style="margin-top:20px;height:4px;width:56px;border-radius:4px;background:${C.mint};line-height:4px;font-size:0;">&nbsp;</div>
      </td></tr>
      <tr><td class="vf-card" style="background:${C.white};border-radius:0 0 20px 20px;padding:36px 36px 32px;">
        <h1 class="vf-h1" style="margin:0 0 18px;font-family:${DISPLAY};font-size:28px;font-weight:800;line-height:1.15;letter-spacing:-0.02em;color:${C.ink};">${escapeHtml(o.heading)}</h1>
        ${o.body}
      </td></tr>
      <tr><td style="padding:24px 24px 8px;text-align:center;font-family:${BODY};font-size:13px;line-height:1.6;color:${C.ink3};">
        ${o.footer}<br>
        <a href="${o.siteUrl}/" style="color:${C.blue};font-weight:700;text-decoration:none;">${escapeHtml(host)}</a> &middot; Find universities and scholarships you actually qualify for.
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

/** A label/value list on a paper panel ("What you told us"). */
function details(title: string, rows: Array<[string, string]>): string {
  const cells = rows
    .map(
      ([label, value]) => `<tr>
        <td style="padding:6px 0;font-family:${BODY};font-size:14px;color:${C.ink3};width:42%;vertical-align:top;">${escapeHtml(label)}</td>
        <td style="padding:6px 0;font-family:${BODY};font-size:14px;font-weight:700;color:${C.ink};vertical-align:top;">${escapeHtml(value)}</td>
      </tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px;background:${C.paper};border-radius:14px;">
    <tr><td style="padding:18px 22px;">
      <div style="margin:0 0 6px;font-family:${BODY};font-size:13px;font-weight:700;color:${C.greenText};">${escapeHtml(title)}</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${cells}</table>
    </td></tr>
  </table>`;
}

/** Numbered steps with mint markers ("How to get the most from it"). */
function steps(items: Array<[string, string]>): string {
  const rows = items
    .map(
      ([title, text], i) => `<tr>
        <td style="width:40px;padding:0 0 18px;vertical-align:top;">
          <div style="width:28px;height:28px;border-radius:999px;background:#E6F4EC;color:${C.greenText};font-family:${DISPLAY};font-size:14px;font-weight:800;line-height:28px;text-align:center;">${i + 1}</div>
        </td>
        <td style="padding:2px 0 18px;vertical-align:top;font-family:${BODY};font-size:15px;line-height:1.55;color:${C.ink2};">
          <strong style="color:${C.ink};">${escapeHtml(title)}</strong><br>${escapeHtml(text)}
        </td>
      </tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 4px;">${rows}</table>`;
}

// ---------------------------------------------------------------------------
// Waitlist: "You're on the list"
// ---------------------------------------------------------------------------

export interface WaitlistEmailInput {
  email: string;
  degree: string | null;
  countries: string[];
  nationality: string | null;
}

export function waitlistConfirmationEmail(input: WaitlistEmailInput, opts: TemplateOptions = {}): RenderedEmail {
  const siteUrl = opts.siteUrl ?? SITE_URL;
  const assetBase = opts.assetBase ?? siteUrl;
  const told: Array<[string, string]> = [
    ["Degree you're aiming for", degreeLabel(input.degree) ?? "Not chosen yet"],
    ["Where you'd like to study", input.countries.length ? input.countries.map((c) => countryName(c)).join(", ") : "Open to anywhere"],
  ];
  if (input.nationality) told.push(["Nationality", countryName(input.nationality)]);

  const subject = "You're on the VarsityFind waitlist";
  const body = [
    paragraph("Thanks for joining. VarsityFind is opening to students a few at a time, starting with the destinations our data covers best."),
    paragraph(`When it's your turn, we'll send your personal invite to <strong style="color:${C.ink};">${escapeHtml(input.email)}</strong>. It works for 30 days and only for this address.`),
    details("What you told us", told),
    paragraph(
      "While you wait, have your transcript, your CGPA and any English test result (IELTS or TOEFL) to hand. Your profile uses them to check, requirement by requirement, which programmes and scholarships you qualify for.",
    ),
    button("Visit VarsityFind", `${siteUrl}/`),
  ].join("\n");

  const html = layout({
    preheader: `We'll send your invite to ${input.email} when it's your turn.`,
    heading: "You're on the list",
    body,
    footer: "You're getting this email because this address joined the VarsityFind waitlist. Didn't mean to, or want off the list? Reply and we'll delete your details.",
    siteUrl,
    assetBase,
  });

  const text = [
    "You're on the list",
    "",
    "Thanks for joining. VarsityFind is opening to students a few at a time, starting with the destinations our data covers best.",
    "",
    `When it's your turn, we'll send your personal invite to ${input.email}. It works for 30 days and only for this address.`,
    "",
    "What you told us:",
    ...told.map(([label, value]) => `- ${label}: ${value}`),
    "",
    "While you wait, have your transcript, your CGPA and any English test result (IELTS or TOEFL) to hand. Your profile uses them to check, requirement by requirement, which programmes and scholarships you qualify for.",
    "",
    `Visit VarsityFind: ${siteUrl}/`,
    "",
    "You're getting this email because this address joined the VarsityFind waitlist. Didn't mean to, or want off the list? Reply and we'll delete your details.",
  ].join("\n");

  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// Sign-up: "Welcome"
// ---------------------------------------------------------------------------

export interface WelcomeEmailInput {
  name: string;
  email: string;
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name.trim();

export function welcomeEmail(input: WelcomeEmailInput, opts: TemplateOptions = {}): RenderedEmail {
  const siteUrl = opts.siteUrl ?? SITE_URL;
  const assetBase = opts.assetBase ?? siteUrl;
  const first = firstName(input.name);
  const how: Array<[string, string]> = [
    ["Complete your profile", "Add your degree, CGPA, grading scale and any English test score. The more you add, the more precisely we can match you."],
    ["See your matches", "Programmes and scholarships you qualify for, with every requirement checked against what you have, and what's missing."],
    ["Keep every deadline in one plan", "Save what you like and track each application, its documents and its closing date in My plan."],
  ];

  const subject = `Welcome to VarsityFind, ${first}`;
  const body = [
    paragraph(`Hi ${escapeHtml(first)}, your account is ready. Here's how to get the most from it:`),
    steps(how),
    button("Complete your profile", `${siteUrl}/profile`),
    paragraph(`<span style="font-size:14px;color:${C.ink3};">You sign in with <strong style="color:${C.ink};">${escapeHtml(input.email)}</strong>.</span>`),
  ].join("\n");

  const html = layout({
    preheader: "Your account is ready. Add your grades to see what you qualify for.",
    heading: `Welcome, ${first}`,
    body,
    footer: "You're getting this email because you created a VarsityFind account. Questions? Just reply to this email.",
    siteUrl,
    assetBase,
  });

  const text = [
    `Welcome, ${first}`,
    "",
    "Your account is ready. Here's how to get the most from it:",
    "",
    ...how.map(([title, line], i) => `${i + 1}. ${title}: ${line}`),
    "",
    `Complete your profile: ${siteUrl}/profile`,
    "",
    `You sign in with ${input.email}.`,
    "",
    "You're getting this email because you created a VarsityFind account. Questions? Just reply to this email.",
  ].join("\n");

  return { subject, html, text };
}
