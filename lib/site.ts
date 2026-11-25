/**
 * The site as search engines see it: its address, name and description, and
 * which paths stay out of search. Used by the root metadata, robots.txt, the
 * sitemap and the landing page's structured data.
 */

/**
 * The public address. NEXT_PUBLIC_SITE_URL is read when the site is built;
 * without it, canonical links still point at production rather than at
 * whichever host served the request (localhost:10000 behind Render's proxy).
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.varsityfind.com").replace(/\/+$/, "");

export const SITE_NAME = "VarsityFind";

export const SITE_TITLE = "VarsityFind: find universities and scholarships abroad you qualify for";

export const SITE_DESCRIPTION =
  "VarsityFind checks your degree, grades and goals against official entry requirements, then shows the master's and PhD programmes and scholarships abroad you actually qualify for, and what's missing.";

/**
 * Pages only signed-in students can open. Crawlers are sent to the login page
 * from all of them, so they stay out of robots' way. Make a page public?
 * Remove it from here and give it its own metadata.
 */
export const PRIVATE_PATHS = [
  "/api/",
  "/admin",
  "/dashboard",
  "/programs",
  "/scholarships",
  "/institutions",
  "/plan",
  "/saved",
  "/applications",
  "/profile",
  "/eligibility",
  "/compare",
  "/dev",
];

/** Organisation and website, as JSON-LD for the landing page. */
export function siteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: `${SITE_URL}/`,
        logo: `${SITE_URL}/icon-512.png`,
        description: SITE_DESCRIPTION,
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: SITE_NAME,
        url: `${SITE_URL}/`,
        description: SITE_DESCRIPTION,
        publisher: { "@id": `${SITE_URL}/#organization` },
        inLanguage: "en-GB",
      },
    ],
  };
}
