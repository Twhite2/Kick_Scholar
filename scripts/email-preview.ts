/**
 * Writes each email to tmp/email-preview/*.html with sample details, so the
 * design can be checked in a browser. The logo loads from this repo's
 * public/ folder rather than the live site.
 *
 *   npm run email:preview
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { inviteEmail, waitlistConfirmationEmail, welcomeEmail } from "../lib/email/templates";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "tmp", "email-preview");
const assetBase = pathToFileURL(path.join(root, "public")).href;
mkdirSync(out, { recursive: true });

const emails = {
  waitlist: waitlistConfirmationEmail(
    { email: "ada.okafor@example.com", degree: "MASTER", countries: ["DE", "NL", "GB"], nationality: "NG" },
    { assetBase },
  ),
  welcome: welcomeEmail({ name: "Ada Okafor", email: "ada.okafor@example.com" }, { assetBase }),
  invite: inviteEmail(
    { email: "ada.okafor@example.com", inviteUrl: "https://www.varsityfind.com/signup?invite=example-token", expiresAt: new Date(Date.now() + 30 * 86400000) },
    { assetBase },
  ),
};

for (const [name, email] of Object.entries(emails)) {
  writeFileSync(path.join(out, `${name}.html`), email.html);
  writeFileSync(path.join(out, `${name}.txt`), `Subject: ${email.subject}\n\n${email.text}\n`);
  console.log(`${name}: "${email.subject}" -> tmp/email-preview/${name}.html`);
}
