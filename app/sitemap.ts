import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { signupMode } from "@/lib/waitlist/core";

/**
 * sitemap.xml: the pages worth finding in search. /waitlist is listed only
 * while sign-up is invite-only; otherwise it redirects to /signup. Built
 * with the site, so a change to SIGNUP_MODE shows up after a rebuild.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const built = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified: built, changeFrequency: "weekly", priority: 1 },
    ...(signupMode() === "invite"
      ? [{ url: `${SITE_URL}/waitlist`, lastModified: built, changeFrequency: "monthly" as const, priority: 0.8 }]
      : []),
  ];
}
