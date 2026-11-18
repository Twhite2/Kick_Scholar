/**
 * What the top-bar search shares between the server and the browser: the
 * response shape, the length limits and where pressing Enter goes.
 */

export const MIN_QUERY = 2;
export const MAX_QUERY = 80;

export interface Suggestion {
  id: string;
  name: string;
  /** One line under the name: "Master's · University of Helsinki, Finland". */
  detail: string;
  country: string | null;
  href: string;
}

export interface SuggestionGroup {
  total: number;
  items: Suggestion[];
  /** The catalogue page with this search applied. */
  href: string;
}

export interface Suggestions {
  q: string;
  programmes: SuggestionGroup;
  universities: SuggestionGroup;
  scholarships: SuggestionGroup;
}

/** Where pressing Enter goes: the catalogue of the section the student is in. */
export function searchTarget(pathname: string, q: string): string {
  const base = pathname.startsWith("/scholarships")
    ? "/scholarships"
    : pathname.startsWith("/institutions")
      ? "/institutions"
      : "/programs";
  const query = q.trim();
  return query ? `${base}?q=${encodeURIComponent(query)}` : base;
}
