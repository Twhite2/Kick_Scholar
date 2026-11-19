import { describe, expect, it } from "vitest";
import {
  INVITE_TTL_DAYS,
  clientIp,
  generateInviteToken,
  hashInviteToken,
  hashIp,
  inviteExpiry,
  invitePath,
  signupMode,
  waitlistFormValues,
  waitlistInputSchema,
} from "../core";

describe("signupMode", () => {
  it("is open unless SIGNUP_MODE says invite", () => {
    expect(signupMode({})).toBe("open");
    expect(signupMode({ SIGNUP_MODE: "open" })).toBe("open");
    expect(signupMode({ SIGNUP_MODE: "nonsense" })).toBe("open");
    expect(signupMode({ SIGNUP_MODE: "invite" })).toBe("invite");
    expect(signupMode({ SIGNUP_MODE: " Invite " })).toBe("invite");
  });
});

describe("invite tokens", () => {
  it("are random, URL-safe and stored only as a hash", () => {
    const a = generateInviteToken();
    const b = generateInviteToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hashInviteToken(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashInviteToken(a)).toBe(hashInviteToken(a));
    expect(hashInviteToken(a)).not.toBe(hashInviteToken(b));
  });

  it("make a sign-up link", () => {
    expect(invitePath("abc_-1")).toBe("/signup?invite=abc_-1");
  });

  it(`expire after ${INVITE_TTL_DAYS} days`, () => {
    const from = new Date("2026-11-17T12:00:00Z");
    expect(inviteExpiry(from).toISOString()).toBe("2026-12-17T12:00:00.000Z");
  });
});

describe("clientIp and hashIp", () => {
  const h = (values: Record<string, string>) => new Headers(values);

  it("takes the first X-Forwarded-For address, then X-Real-IP", () => {
    expect(clientIp(h({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
    expect(clientIp(h({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientIp(h({}))).toBeNull();
  });

  it("is keyed, and stores nothing without an IP or a secret", () => {
    expect(hashIp("203.0.113.7", "s1")).toBe(hashIp("203.0.113.7", "s1"));
    expect(hashIp("203.0.113.7", "s1")).not.toBe(hashIp("203.0.113.7", "s2"));
    expect(hashIp(null, "s1")).toBeNull();
    expect(hashIp("203.0.113.7", undefined)).toBeNull();
  });
});

function form(fields: Array<[string, string]>) {
  const fd = new FormData();
  for (const [k, v] of fields) fd.append(k, v);
  return waitlistInputSchema.safeParse(waitlistFormValues(fd));
}

describe("waitlistInputSchema", () => {
  it("accepts a full answer and normalises it", () => {
    const r = form([
      ["email", "  Ada@Example.COM "],
      ["desiredDegreeLevel", "MASTER"],
      ["preferredCountries", "DE"],
      ["preferredCountries", "NL"],
      ["preferredCountries", "DE"],
      ["nationality", "Nigeria"],
      ["source", "twitter"],
    ]);
    expect(r.success).toBe(true);
    expect(r.data).toEqual({
      email: "ada@example.com",
      desiredDegreeLevel: "MASTER",
      preferredCountries: ["DE", "NL"],
      nationality: "Nigeria",
      source: "twitter",
    });
  });

  it("treats countries, nationality and source as optional", () => {
    const r = form([
      ["email", "a@b.co"],
      ["desiredDegreeLevel", "PHD"],
      ["nationality", ""],
    ]);
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({ preferredCountries: [], nationality: null, source: null });
  });

  it("rejects what the form can't produce", () => {
    const bad = (fields: Array<[string, string]>) => form(fields).error?.issues.map((i) => i.path[0]);
    expect(bad([["email", "not-an-email"], ["desiredDegreeLevel", "MASTER"]])).toEqual(["email"]);
    expect(bad([["email", "a@b.co"], ["desiredDegreeLevel", "HIGH_SCHOOL"]])).toEqual(["desiredDegreeLevel"]);
    expect(bad([["email", "a@b.co"], ["desiredDegreeLevel", "MASTER"], ["preferredCountries", "US"]])).toEqual(["preferredCountries"]);
    expect(bad([["email", "a@b.co"], ["desiredDegreeLevel", "MASTER"], ["nationality", "Atlantis"]])).toEqual(["nationality"]);
    expect(
      bad([
        ["email", "a@b.co"],
        ["desiredDegreeLevel", "MASTER"],
        ["preferredCountries", "DE"],
        ["preferredCountries", "NL"],
        ["preferredCountries", "FR"],
        ["preferredCountries", "SE"],
      ]),
    ).toEqual(["preferredCountries"]);
  });

  it("caps the source at 100 characters", () => {
    const r = form([["email", "a@b.co"], ["desiredDegreeLevel", "MASTER"], ["source", "x".repeat(300)]]);
    expect(r.data?.source).toHaveLength(100);
  });
});
