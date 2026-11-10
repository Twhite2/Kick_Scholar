/**
 * Routes and labels for the student shell (docs/ui-remodel.md §7.3). Labels
 * are British; route paths are unchanged.
 */

export interface NavLink {
  label: string;
  href: string;
  match: (pathname: string) => boolean;
}

const starts = (prefix: string) => (p: string) => p === prefix || p.startsWith(`${prefix}/`);

export const TOP_NAV: NavLink[] = [
  { label: "Home", href: "/dashboard", match: starts("/dashboard") },
  { label: "Programmes", href: "/programs", match: starts("/programs") },
  { label: "Scholarships", href: "/scholarships", match: starts("/scholarships") },
  { label: "Universities", href: "/institutions", match: starts("/institutions") },
  {
    label: "My plan",
    href: "/plan",
    match: (p) => starts("/plan")(p) || starts("/saved")(p) || starts("/applications")(p),
  },
];

export const EXPLORE = [
  { label: "Programmes", href: "/programs" },
  { label: "Scholarships", href: "/scholarships" },
  { label: "Universities", href: "/institutions" },
] as const;

export function isExploreRoute(pathname: string): boolean {
  return ["/programs", "/scholarships", "/institutions", "/compare"].some((p) => starts(p)(pathname));
}

/**
 * Pages whose top sits on a dark "night" banner: the header turns transparent
 * and floats over it (§7.1).
 */
export function isNightRoute(pathname: string): boolean {
  if (pathname === "/dashboard") return true;
  return /^\/(programs|scholarships|institutions)\/[^/]+\/?$/.test(pathname);
}
