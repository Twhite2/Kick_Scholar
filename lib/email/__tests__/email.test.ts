import { afterEach, describe, expect, it, vi } from "vitest";
import { parseAddress, sendEmail } from "../send";
import { escapeHtml, inviteEmail, waitlistConfirmationEmail, welcomeEmail } from "../templates";

afterEach(() => vi.unstubAllGlobals());

const site = { siteUrl: "https://www.varsityfind.com" };

describe("waitlist confirmation", () => {
  it("confirms the address and repeats the answers in words", () => {
    const e = waitlistConfirmationEmail({ email: "ada@example.com", degree: "MASTER", countries: ["DE", "NL"], nationality: "NG" }, site);
    expect(e.subject).toBe("You're on the VarsityFind waitlist");
    for (const part of ["You&#39;re on the", "ada@example.com", "Master&#39;s", ">Germany<", ">Netherlands<", ">Nigeria<", "20,000+"]) expect(e.html).toContain(part);
    expect(e.html).toContain('src="https://www.varsityfind.com/email/banner-waitlist.png"');
    expect(e.text).toContain("Where you'd like to study: Germany, Netherlands");
    expect(e.html).toContain('src="https://www.varsityfind.com/email/varsityfind-logo-reversed.png"');
    expect(e.html).toContain('href="https://www.varsityfind.com/"');
  });

  it("says when no degree or country was chosen, and leaves nationality out when not given", () => {
    const e = waitlistConfirmationEmail({ email: "a@example.com", degree: null, countries: [], nationality: null }, site);
    expect(e.text).toContain("Degree you're aiming for: Not chosen yet");
    expect(e.text).toContain("Where you'd like to study: Open to anywhere");
    expect(e.text).not.toContain("Nationality");
  });
});

describe("welcome", () => {
  it("greets by first name and links to the profile", () => {
    const e = welcomeEmail({ name: "Ada Okafor", email: "ada@example.com" }, site);
    expect(e.subject).toBe("Welcome to VarsityFind, Ada");
    expect(e.html).toContain('href="https://www.varsityfind.com/profile"');
    expect(e.text).toContain("1. Complete your profile");
  });

  it("escapes what people type", () => {
    const e = welcomeEmail({ name: '<script>alert("x")</script>', email: "x@example.com" }, site);
    expect(e.html).not.toContain("<script>alert");
    expect(e.html).toContain(escapeHtml("<script>alert"));
  });
});

describe("sendEmail", () => {
  const email = { to: "ada@example.com", subject: "Hi", html: "<p>Hi</p>", text: "Hi", tag: "welcome" };

  it("logs instead of sending when Mailjet isn't configured", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    vi.spyOn(console, "info").mockImplementation(() => {});
    expect(await sendEmail(email, {})).toEqual({ sent: false, reason: "not configured" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("posts one message to Mailjet's Send API from the configured address", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ Messages: [{ Status: "success" }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const result = await sendEmail(email, { MAILJET_API_KEY: "k", MAILJET_SECRET_KEY: "s", EMAIL_FROM: "VarsityFind <info@varsityfind.com>" });
    expect(result).toEqual({ sent: true });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://api.mailjet.com/v3.1/send");
    expect(init.headers.Authorization).toBe(`Basic ${Buffer.from("k:s").toString("base64")}`);
    const message = JSON.parse(init.body).Messages[0];
    expect(message).toMatchObject({
      From: { Email: "info@varsityfind.com", Name: "VarsityFind" },
      To: [{ Email: "ada@example.com" }],
      Subject: "Hi",
      TextPart: "Hi",
      HTMLPart: "<p>Hi</p>",
    });
  });

  it("reports a refusal without throwing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ Messages: [{ Status: "error", Errors: [{ ErrorMessage: "sender not validated" }] }] }), { status: 400 })));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await sendEmail(email, { MAILJET_API_KEY: "k", MAILJET_SECRET_KEY: "s" });
    expect(result.sent).toBe(false);
    expect(result.sent === false && result.reason).toContain("sender not validated");
  });

  it("reads display-name addresses", () => {
    expect(parseAddress("VarsityFind <info@varsityfind.com>")).toEqual({ name: "VarsityFind", email: "info@varsityfind.com" });
    expect(parseAddress("info@varsityfind.com")).toEqual({ name: null, email: "info@varsityfind.com" });
  });
});

describe("invite", () => {
  it("carries the personal link, its expiry and the address it works for", () => {
    const url = "https://www.varsityfind.com/signup?invite=abc_123-XYZ";
    const e = inviteEmail({ email: "ada@example.com", inviteUrl: url, expiresAt: new Date("2026-12-25T10:00:00Z") }, site);
    expect(e.subject).toBe("Your VarsityFind invite is here");
    expect(e.html).toContain(`href="${url}"`);
    expect(e.html).toContain("25 December 2026");
    expect(e.html).toContain("ada@example.com");
    expect(e.html).toContain('src="https://www.varsityfind.com/email/banner-invite.png"');
    expect(e.text).toContain(`Create your account: ${url}`);
    expect(e.text).toContain("works until 25 December 2026, and only for ada@example.com");
  });
});
