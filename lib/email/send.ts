/**
 * Sends one email through Mailjet's HTTPS API (Send API v3.1).
 *
 * HTTPS rather than SMTP: Render's free web services block outgoing SMTP
 * ports, and an API call works on every plan. Without MAILJET_API_KEY and
 * MAILJET_SECRET_KEY (as in development) the email is logged, not sent.
 * Never throws: a failed email must not fail a sign-up, so errors are
 * logged and reported in the result instead.
 */

export interface Email {
  to: string;
  toName?: string | null;
  subject: string;
  html: string;
  text: string;
  /** A label for Mailjet's logs, e.g. "waitlist-confirmation". */
  tag?: string;
}

export type SendResult = { sent: true } | { sent: false; reason: string };

const MAILJET_SEND_URL = "https://api.mailjet.com/v3.1/send";

/** "VarsityFind <info@varsityfind.com>" -> { name, email }. */
export function parseAddress(value: string): { name: string | null; email: string } {
  const m = value.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return m ? { name: m[1].replace(/^"|"$/g, "") || null, email: m[2].trim() } : { name: null, email: value.trim() };
}

export async function sendEmail(email: Email, env: Record<string, string | undefined> = process.env): Promise<SendResult> {
  const key = env.MAILJET_API_KEY?.trim();
  const secret = env.MAILJET_SECRET_KEY?.trim();
  if (!key || !secret) {
    console.info(`[email] not sent (no Mailjet keys): "${email.subject}" to ${email.to}`);
    return { sent: false, reason: "not configured" };
  }

  const from = parseAddress(env.EMAIL_FROM?.trim() || "VarsityFind <info@varsityfind.com>");
  const replyTo = env.EMAIL_REPLY_TO?.trim() ? parseAddress(env.EMAIL_REPLY_TO) : null;
  const message = {
    From: { Email: from.email, ...(from.name ? { Name: from.name } : {}) },
    To: [{ Email: email.to, ...(email.toName ? { Name: email.toName } : {}) }],
    ...(replyTo ? { ReplyTo: { Email: replyTo.email, ...(replyTo.name ? { Name: replyTo.name } : {}) } } : {}),
    Subject: email.subject,
    TextPart: email.text,
    HTMLPart: email.html,
    ...(email.tag ? { CustomCampaign: email.tag, CustomID: email.tag } : {}),
  };

  try {
    const res = await fetch(MAILJET_SEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ Messages: [message] }),
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await res.json().catch(() => null)) as { Messages?: Array<{ Status?: string; Errors?: unknown }> } | null;
    const status = body?.Messages?.[0]?.Status;
    if (!res.ok || status !== "success") {
      const reason = `Mailjet ${res.status}${status ? ` ${status}` : ""}: ${JSON.stringify(body?.Messages?.[0]?.Errors ?? body).slice(0, 300)}`;
      console.error(`[email] "${email.subject}" to ${email.to} failed: ${reason}`);
      return { sent: false, reason };
    }
    return { sent: true };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error(`[email] "${email.subject}" to ${email.to} failed: ${reason}`);
    return { sent: false, reason };
  }
}
