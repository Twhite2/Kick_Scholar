import { SITE_URL } from "@/lib/site";
import { countryName } from "@/lib/ui/country";
import { degreeLabel } from "@/lib/ui/requirements";

/**
 * VarsityFind's emails, in the site's look: a Night hero with the logo, a
 * mint eyebrow and a big headline over one of the site's scene
 * illustrations; then white content blocks, a catalogue band in round
 * figures, and Varsity Blue pill buttons. Built from tables with inline
 * styles, because that is what email clients (Gmail, Outlook) reliably
 * render. Bricolage Grotesque loads where a client allows web fonts and
 * falls back to Helvetica/Arial elsewhere. Images live in public/email.
 */

const C = {
  night: "#071D33",
  nightRaised: "#0D2C4A",
  paper: "#F3F5F8",
  white: "#FFFFFF",
  ink: "#0E1B2A",
  ink2: "#2B3A4B",
  ink3: "#546477",
  onNight: "#C9D6E3",
  line: "#E4E9EF",
  blue: "#0B4F8C",
  blueTint: "#E7F0F9",
  mint: "#6FD39B",
  green: "#2E8B57",
  greenTint: "#E6F4EC",
  greenText: "#1F7A4D",
};
const DISPLAY = "'Bricolage Grotesque', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const BODY = "'Atkinson Hyperlegible Next', 'Helvetica Neue', Helvetica, Arial, sans-serif";

/** The catalogue in round figures: true as long as it only grows. */
const CATALOGUE: Array<[string, string]> = [
  ["20,000+", "programmes"],
  ["4,000+", "universities"],
  ["350+", "scholarships"],
];

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export interface TemplateOptions {
  /** The site address links point to. */
  siteUrl?: string;
  /** Where images load from (the live site; a local folder for previews). */
  assetBase?: string;
}

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

function button(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
  <tr><td align="center" style="border-radius:999px;background:${C.blue};">
    <a href="${href}" style="display:inline-block;padding:16px 34px;border-radius:999px;font-family:${BODY};font-size:16px;font-weight:700;line-height:1;color:${C.white};text-decoration:none;">${escapeHtml(label)} &rarr;</a>
  </td></tr>
</table>`;
}

function paragraph(html: string, style = ""): string {
  return `<p style="margin:0 0 16px;font-family:${BODY};font-size:16px;line-height:1.6;color:${C.ink2};${style}">${html}</p>`;
}

/** A small heading inside the white card. */
function sectionTitle(text: string): string {
  return `<h2 style="margin:0 0 14px;font-family:${DISPLAY};font-size:20px;font-weight:800;line-height:1.25;letter-spacing:-0.01em;color:${C.ink};">${escapeHtml(text)}</h2>`;
}

/** Pills, as the site shows filters and facts. */
function pills(items: string[], tone: "blue" | "green" = "blue"): string {
  const bg = tone === "blue" ? C.blueTint : C.greenTint;
  const fg = tone === "blue" ? C.blue : C.greenText;
  return items
    .map(
      (t) =>
        `<span style="display:inline-block;margin:0 6px 8px 0;padding:7px 14px;border-radius:999px;background:${bg};font-family:${BODY};font-size:14px;font-weight:700;color:${fg};">${escapeHtml(t)}</span>`,
    )
    .join("");
}

/**
 * A vertical timeline: done steps get a filled mint marker, the rest an
 * outlined one, joined by a thin line.
 */
function timeline(steps: Array<{ title: string; text: string; done?: boolean }>): string {
  const rows = steps
    .map((s, i) => {
      const last = i === steps.length - 1;
      const marker = s.done
        ? `<div style="width:30px;height:30px;border-radius:999px;background:${C.green};color:${C.white};font-family:${BODY};font-size:16px;font-weight:700;line-height:30px;text-align:center;">&#10003;</div>`
        : `<div style="width:26px;height:26px;border-radius:999px;border:2px solid ${C.line};background:${C.white};color:${C.ink3};font-family:${DISPLAY};font-size:13px;font-weight:800;line-height:26px;text-align:center;">${i + 1}</div>`;
      const connector = last ? "" : `<div style="width:2px;height:44px;margin:6px auto 0;background:${C.line};line-height:44px;font-size:0;">&nbsp;</div>`;
      return `<tr>
        <td style="width:30px;vertical-align:top;padding:0;">${marker}${connector}</td>
        <td style="vertical-align:top;padding:3px 0 ${last ? 0 : 14}px 16px;">
          <div style="font-family:${DISPLAY};font-size:16px;font-weight:800;color:${s.done ? C.greenText : C.ink};">${escapeHtml(s.title)}</div>
          <div style="margin-top:4px;font-family:${BODY};font-size:14px;line-height:1.55;color:${C.ink3};">${escapeHtml(s.text)}</div>
        </td>
      </tr>`;
    })
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>`;
}

/** A checklist with mint ticks. */
function checklist(items: string[]): string {
  const rows = items
    .map(
      (t) => `<tr>
        <td style="width:26px;vertical-align:top;padding:0 0 10px;">
          <div style="width:20px;height:20px;border-radius:999px;background:${C.greenTint};color:${C.greenText};font-family:${BODY};font-size:12px;font-weight:700;line-height:20px;text-align:center;">&#10003;</div>
        </td>
        <td style="vertical-align:top;padding:1px 0 10px 8px;font-family:${BODY};font-size:15px;line-height:1.5;color:${C.ink2};">${escapeHtml(t)}</td>
      </tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>`;
}

/** Numbered step cards ("Your first three steps"). */
function stepCards(items: Array<[string, string]>): string {
  return items
    .map(
      ([title, text], i) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px;border:1px solid ${C.line};border-radius:16px;">
        <tr>
          <td style="width:44px;vertical-align:top;padding:18px 0 18px 18px;">
            <div style="width:36px;height:36px;border-radius:12px;background:${C.blueTint};color:${C.blue};font-family:${DISPLAY};font-size:17px;font-weight:800;line-height:36px;text-align:center;">${i + 1}</div>
          </td>
          <td style="vertical-align:top;padding:18px 18px 18px 14px;">
            <div style="font-family:${DISPLAY};font-size:16px;font-weight:800;color:${C.ink};">${escapeHtml(title)}</div>
            <div style="margin-top:4px;font-family:${BODY};font-size:14px;line-height:1.55;color:${C.ink3};">${escapeHtml(text)}</div>
          </td>
        </tr>
      </table>`,
    )
    .join("");
}

/** The catalogue in round figures, on a Night band. */
function catalogueBand(): string {
  const cells = CATALOGUE.map(
    ([n, label]) => `<td align="center" style="width:33%;padding:22px 6px;vertical-align:top;">
      <div class="vf-stat" style="font-family:${DISPLAY};font-size:26px;font-weight:800;letter-spacing:-0.02em;color:${C.mint};">${n}</div>
      <div style="margin-top:4px;font-family:${BODY};font-size:13px;color:${C.onNight};">${label}</div>
    </td>`,
  ).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.nightRaised};border-radius:18px;">
    <tr>${cells}</tr>
  </table>`;
}

function hero(o: { eyebrow: string; headline: string; subtitle: string; banner: string; siteUrl: string; assetBase: string }): string {
  return `<tr><td style="background:${C.night};border-radius:24px 24px 0 0;padding:0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td class="vf-pad" style="padding:30px 40px 0;">
        <a href="${o.siteUrl}/" style="text-decoration:none;"><img src="${o.assetBase}/email/varsityfind-logo-reversed.png" width="168" height="26" alt="VarsityFind" style="display:block;border:0;width:168px;height:auto;color:${C.white};font-family:${DISPLAY};font-size:22px;font-weight:800;"></a>
      </td></tr>
      <tr><td class="vf-pad" style="padding:34px 40px 0;">
        <div style="font-family:${BODY};font-size:14px;font-weight:700;letter-spacing:0.02em;color:${C.mint};">${escapeHtml(o.eyebrow)}</div>
        <h1 class="vf-h1" style="margin:10px 0 12px;font-family:${DISPLAY};font-size:40px;font-weight:800;line-height:1.05;letter-spacing:-0.03em;color:${C.white};">${o.headline}</h1>
        <p style="margin:0;font-family:${BODY};font-size:17px;line-height:1.55;color:${C.onNight};">${escapeHtml(o.subtitle)}</p>
      </td></tr>
      <tr><td style="padding:24px 0 0;">
        <img src="${o.assetBase}/email/${o.banner}" width="600" alt="" style="display:block;border:0;width:100%;max-width:600px;height:auto;">
      </td></tr>
    </table>
  </td></tr>`;
}

function layout(o: { title: string; preheader: string; hero: string; body: string; footer: string; siteUrl: string }): string {
  const host = new URL(o.siteUrl).host.replace(/^www\./, "");
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(o.title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Atkinson+Hyperlegible+Next:wght@400;700&display=swap" rel="stylesheet">
<style>
  @media (max-width: 620px) {
    .vf-pad { padding-left: 24px !important; padding-right: 24px !important; }
    .vf-h1 { font-size: 32px !important; }
    .vf-stat { font-size: 21px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${C.paper};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.paper};">${escapeHtml(o.preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.paper};">
  <tr><td align="center" style="padding:28px 10px 36px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
      ${o.hero}
      <tr><td class="vf-pad" style="background:${C.white};border-radius:0 0 24px 24px;padding:36px 40px 40px;">
        ${o.body}
      </td></tr>
      <tr><td style="padding:26px 24px 0;text-align:center;font-family:${BODY};font-size:13px;line-height:1.65;color:${C.ink3};">
        ${o.footer}<br>
        <a href="${o.siteUrl}/" style="color:${C.blue};font-weight:700;text-decoration:none;">${escapeHtml(host)}</a> &middot; Find universities and scholarships you actually qualify for.
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

const gap = (px: number) => `<div style="height:${px}px;line-height:${px}px;font-size:0;">&nbsp;</div>`;
const accent = (word: string) => `<span style="color:${C.mint};">${escapeHtml(word)}</span>`;

// ---------------------------------------------------------------------------
// Waitlist: "You're on the list"
// ---------------------------------------------------------------------------

export interface WaitlistEmailInput {
  email: string;
  degree: string | null;
  countries: string[];
  nationality: string | null;
}

const NEXT_STEPS = (email: string) => [
  { title: "You joined the waitlist", text: "Your place is saved.", done: true },
  {
    title: "We email your invite",
    text: `We're letting students in a few at a time, starting with the destinations our data covers best. Your invite comes to ${email} and works for 30 days.`,
  },
  { title: "You see what you qualify for", text: "Create your account, add your grades, and get the programmes and scholarships you can actually get into." },
];

const GET_READY = [
  "Your transcript or latest results",
  "Your CGPA and the scale it's out of (for example 3.68 out of 5)",
  "Any English test result (IELTS or TOEFL), or proof your degree was taught in English",
];

export function waitlistConfirmationEmail(input: WaitlistEmailInput, opts: TemplateOptions = {}): RenderedEmail {
  const siteUrl = opts.siteUrl ?? SITE_URL;
  const assetBase = opts.assetBase ?? siteUrl;
  const degree = degreeLabel(input.degree);
  const countries = input.countries.map((c) => countryName(c));
  const nationality = input.nationality ? countryName(input.nationality) : null;

  const told = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.paper};border-radius:18px;">
    <tr><td style="padding:22px 24px 14px;">
      <div style="margin:0 0 10px;font-family:${BODY};font-size:13px;font-weight:700;color:${C.ink3};">Degree you're aiming for</div>
      ${pills([degree ?? "Not chosen yet"])}
      <div style="margin:8px 0 10px;font-family:${BODY};font-size:13px;font-weight:700;color:${C.ink3};">Where you'd like to study</div>
      ${pills(countries.length ? countries : ["Open to anywhere"])}
      ${nationality ? `<div style="margin:8px 0 10px;font-family:${BODY};font-size:13px;font-weight:700;color:${C.ink3};">Nationality</div>${pills([nationality], "green")}` : ""}
    </td></tr>
  </table>`;

  const body = [
    sectionTitle("What happens next"),
    timeline(NEXT_STEPS(input.email)),
    gap(30),
    sectionTitle("What you told us"),
    told,
    gap(30),
    sectionTitle("Get these ready while you wait"),
    paragraph("Your profile uses them to check, requirement by requirement, what you qualify for.", "font-size:15px;color:" + C.ink3 + ";"),
    checklist(GET_READY),
    gap(26),
    catalogueBand(),
    gap(30),
    button("Explore VarsityFind", `${siteUrl}/`),
  ].join("\n");

  const subject = "You're on the VarsityFind waitlist";
  const html = layout({
    title: subject,
    preheader: `Your place is saved. We'll email your invite to ${input.email} when it's your turn.`,
    hero: hero({
      eyebrow: "You're in",
      headline: `You're on the ${accent("list")}`,
      subtitle: "Your place is saved. We'll let you know the moment it's your turn.",
      banner: "banner-waitlist.png",
      siteUrl,
      assetBase,
    }),
    body,
    footer: "You're getting this email because this address joined the VarsityFind waitlist. Didn't mean to, or want off the list? Reply and we'll delete your details.",
    siteUrl,
  });

  const text = [
    "You're on the list",
    "Your place is saved. We'll let you know the moment it's your turn.",
    "",
    "WHAT HAPPENS NEXT",
    ...NEXT_STEPS(input.email).map((s, i) => `${i + 1}. ${s.title}${s.done ? " (done)" : ""}: ${s.text}`),
    "",
    "WHAT YOU TOLD US",
    `- Degree you're aiming for: ${degree ?? "Not chosen yet"}`,
    `- Where you'd like to study: ${countries.length ? countries.join(", ") : "Open to anywhere"}`,
    ...(nationality ? [`- Nationality: ${nationality}`] : []),
    "",
    "GET THESE READY WHILE YOU WAIT",
    ...GET_READY.map((t) => `- ${t}`),
    "",
    `VarsityFind: ${CATALOGUE.map(([n, l]) => `${n} ${l}`).join(", ")}.`,
    `Explore VarsityFind: ${siteUrl}/`,
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

const FIRST_STEPS: Array<[string, string]> = [
  ["Complete your profile", "Add your degree, CGPA, grading scale and any English test score. The more you add, the more precisely we match you."],
  ["See your matches", "Programmes and scholarships you qualify for, each with every requirement checked against what you have."],
  ["Keep every deadline in one plan", "Save what you like and track each application, its documents and its closing date in My plan."],
];

export function welcomeEmail(input: WelcomeEmailInput, opts: TemplateOptions = {}): RenderedEmail {
  const siteUrl = opts.siteUrl ?? SITE_URL;
  const assetBase = opts.assetBase ?? siteUrl;
  const first = firstName(input.name);

  const example = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.night};border-radius:20px;">
    <tr><td align="center" style="padding:26px 20px 10px;">
      <img src="${assetBase}/email/match-card.png" width="340" alt="An example match: MSc in Computer Science at the University of Helsinki, 92. Your degree fits the course; your CGPA clears the entry bar; needs an English test score; a linked scholarship can cover tuition." style="display:block;border:0;width:340px;max-width:100%;height:auto;">
    </td></tr>
    <tr><td align="center" style="padding:6px 28px 24px;font-family:${BODY};font-size:14px;line-height:1.55;color:${C.onNight};">
      Every match shows why you fit, and exactly what's missing.
    </td></tr>
  </table>`;

  const body = [
    paragraph(`Hi ${escapeHtml(first)}, your account is ready. Here's what VarsityFind does for you, and how to start.`),
    gap(8),
    sectionTitle("This is what a match looks like"),
    example,
    gap(30),
    sectionTitle("Your first three steps"),
    stepCards(FIRST_STEPS),
    gap(18),
    catalogueBand(),
    gap(30),
    button("Complete your profile", `${siteUrl}/profile`),
    gap(18),
    paragraph(`You sign in with <strong style="color:${C.ink};">${escapeHtml(input.email)}</strong>.`, `text-align:center;font-size:14px;color:${C.ink3};margin:0;`),
  ].join("\n");

  const subject = `Welcome to VarsityFind, ${first}`;
  const html = layout({
    title: subject,
    preheader: "Your account is ready. Add your grades to see what you qualify for.",
    hero: hero({
      eyebrow: "Your account is ready",
      headline: `Welcome, ${accent(first)}`,
      subtitle: "Let's find where your grades can take you.",
      banner: "banner-welcome.png",
      siteUrl,
      assetBase,
    }),
    body,
    footer: "You're getting this email because you created a VarsityFind account. Questions? Just reply to this email.",
    siteUrl,
  });

  const text = [
    `Welcome, ${first}`,
    "Let's find where your grades can take you.",
    "",
    "Your account is ready. Every match shows why you fit, and exactly what's missing.",
    "",
    "YOUR FIRST THREE STEPS",
    ...FIRST_STEPS.map(([title, line], i) => `${i + 1}. ${title}: ${line}`),
    "",
    `VarsityFind: ${CATALOGUE.map(([n, l]) => `${n} ${l}`).join(", ")}.`,
    `Complete your profile: ${siteUrl}/profile`,
    "",
    `You sign in with ${input.email}.`,
    "",
    "You're getting this email because you created a VarsityFind account. Questions? Just reply to this email.",
  ].join("\n");

  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// Invite: "It's your turn"
// ---------------------------------------------------------------------------

export interface InviteEmailInput {
  email: string;
  /** The personal sign-up link (absolute). */
  inviteUrl: string;
  expiresAt: Date;
}

const INVITE_STEPS: Array<[string, string]> = [
  ["Create your account", "Open your invite link and choose a password. It takes about a minute."],
  ["Add your grades", "Your degree, CGPA, grading scale and any English test score. Your waitlist answers are filled in already."],
  ["See what you qualify for", "Programmes and scholarships matched to you, each requirement checked against what you have."],
];

const longDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export function inviteEmail(input: InviteEmailInput, opts: TemplateOptions = {}): RenderedEmail {
  const siteUrl = opts.siteUrl ?? SITE_URL;
  const assetBase = opts.assetBase ?? siteUrl;
  const until = longDate(input.expiresAt);

  const linkPanel = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.paper};border-radius:18px;">
    <tr><td align="center" style="padding:28px 24px 24px;">
      ${button("Create your account", input.inviteUrl)}
      <p style="margin:18px 0 0;font-family:${BODY};font-size:14px;line-height:1.6;color:${C.ink3};">
        Your link works until <strong style="color:${C.ink};">${escapeHtml(until)}</strong>, and only for <strong style="color:${C.ink};">${escapeHtml(input.email)}</strong>.
      </p>
    </td></tr>
  </table>`;

  const body = [
    paragraph("Your place on the VarsityFind waitlist has come up. Your account is waiting: create it and see the programmes and scholarships you actually qualify for."),
    gap(6),
    linkPanel,
    gap(30),
    sectionTitle("What happens next"),
    stepCards(INVITE_STEPS),
    gap(18),
    catalogueBand(),
    gap(26),
    paragraph(
      `Button not working? Copy this link into your browser:<br><a href="${input.inviteUrl}" style="color:${C.blue};word-break:break-all;">${escapeHtml(input.inviteUrl)}</a>`,
      `font-size:13px;color:${C.ink3};margin:0;`,
    ),
  ].join("\n");

  const subject = "Your VarsityFind invite is here";
  const html = layout({
    title: subject,
    preheader: `It's your turn. Your personal link works until ${until}.`,
    hero: hero({
      eyebrow: "Your invite is here",
      headline: `It's your ${accent("turn")}`,
      subtitle: "The doors are open. Create your account and see where your grades can take you.",
      banner: "banner-invite.png",
      siteUrl,
      assetBase,
    }),
    body,
    footer: "You're getting this email because this address joined the VarsityFind waitlist. The link is personal: please don't forward it. Not expecting this? You can ignore it.",
    siteUrl,
  });

  const text = [
    "It's your turn",
    "The doors are open. Create your account and see where your grades can take you.",
    "",
    "Your place on the VarsityFind waitlist has come up. Your account is waiting: create it and see the programmes and scholarships you actually qualify for.",
    "",
    `Create your account: ${input.inviteUrl}`,
    `Your link works until ${until}, and only for ${input.email}.`,
    "",
    "WHAT HAPPENS NEXT",
    ...INVITE_STEPS.map(([title, line], i) => `${i + 1}. ${title}: ${line}`),
    "",
    `VarsityFind: ${CATALOGUE.map(([n, l]) => `${n} ${l}`).join(", ")}.`,
    "",
    "You're getting this email because this address joined the VarsityFind waitlist. The link is personal: please don't forward it. Not expecting this? You can ignore it.",
  ].join("\n");

  return { subject, html, text };
}
