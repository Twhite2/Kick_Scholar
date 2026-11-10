import type { InstitutionFace } from "@/lib/types/cards";

/** The University columns every card needs for its face (logo, flag, cover). */
export const institutionFaceSelect = {
  id: true,
  name: true,
  acronym: true,
  country: true,
  city: true,
  logoUrl: true,
  coverUrl: true,
  coverWidth: true,
  coverHeight: true,
  coverColor: true,
  coverCredit: true,
  coverLicense: true,
  coverLicenseUrl: true,
  coverSourceUrl: true,
} as const;

export interface InstitutionFaceRow {
  id: string;
  name: string;
  acronym: string | null;
  country: string;
  city: string;
  logoUrl: string | null;
  coverUrl: string | null;
  coverWidth: number | null;
  coverHeight: number | null;
  coverColor: string | null;
  coverCredit: string | null;
  coverLicense: string | null;
  coverLicenseUrl: string | null;
  coverSourceUrl: string | null;
}

/**
 * Only URLs on our own storage are shown (§3: no third-party hotlinking).
 * The media script writes either a site-relative path or the configured
 * storage origin; anything else is ignored rather than fetched from a
 * stranger's server on every page view.
 */
export function isOwnMediaUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  if (url.startsWith("/")) return !url.startsWith("//");
  const base = process.env.NEXT_PUBLIC_MEDIA_BASE_URL;
  return Boolean(base && url.startsWith(base));
}

export function toInstitutionFace(u: InstitutionFaceRow): InstitutionFace {
  const hasCover = isOwnMediaUrl(u.coverUrl) && u.coverWidth && u.coverHeight;
  return {
    id: u.id,
    name: u.name,
    acronym: u.acronym,
    countryCode: u.country || null,
    city: u.city || null,
    logoUrl: isOwnMediaUrl(u.logoUrl) ? u.logoUrl : null,
    cover: hasCover
      ? {
          url: u.coverUrl!,
          width: u.coverWidth!,
          height: u.coverHeight!,
          color: u.coverColor,
          credit: u.coverCredit,
          license: u.coverLicense,
          licenseUrl: u.coverLicenseUrl,
          sourceUrl: u.coverSourceUrl,
        }
      : null,
  };
}

/** A provider without a matching institution still gets a stable monogram. */
export function providerFace(name: string): InstitutionFace {
  return { id: `provider:${name}`, name, acronym: null, countryCode: null, city: null, logoUrl: null, cover: null };
}
