import { afterEach, describe, expect, it, vi } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { PRIVATE_PATHS, SITE_URL, siteJsonLd } from "../site";

afterEach(() => vi.unstubAllEnvs());

describe("robots.txt", () => {
  it("opens the public pages, closes the signed-in zone and names the sitemap", () => {
    const r = robots();
    const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    expect(rule.allow).toBe("/");
    expect(rule.disallow).toEqual(PRIVATE_PATHS);
    for (const path of ["/api/", "/admin", "/dashboard", "/programs", "/profile"]) expect(rule.disallow).toContain(path);
    // Public pages are not blocked.
    for (const path of ["/waitlist", "/login", "/signup", "/credits"]) expect(rule.disallow).not.toContain(path);
    expect(r.sitemap).toBe(`${SITE_URL}/sitemap.xml`);
  });
});

describe("sitemap.xml", () => {
  it("lists the waitlist only while sign-up is invite-only", () => {
    vi.stubEnv("SIGNUP_MODE", "invite");
    expect(sitemap().map((e) => e.url)).toEqual([`${SITE_URL}/`, `${SITE_URL}/waitlist`]);
    vi.stubEnv("SIGNUP_MODE", "open");
    expect(sitemap().map((e) => e.url)).toEqual([`${SITE_URL}/`]);
  });

  it("never lists a private page", () => {
    vi.stubEnv("SIGNUP_MODE", "invite");
    for (const { url } of sitemap()) {
      const path = new URL(url).pathname;
      expect(PRIVATE_PATHS.some((p) => path.startsWith(p))).toBe(false);
    }
  });
});

describe("structured data", () => {
  it("describes the organisation and the website on absolute addresses", () => {
    const data = siteJsonLd();
    const types = data["@graph"].map((n) => n["@type"]);
    expect(types).toEqual(["Organization", "WebSite"]);
    for (const node of data["@graph"]) expect(node.url).toBe(`${SITE_URL}/`);
    expect(data["@graph"][0]).toMatchObject({ name: "VarsityFind", logo: `${SITE_URL}/icon-512.png` });
    expect(SITE_URL).toMatch(/^https:\/\/[^/]+$/);
  });
});
