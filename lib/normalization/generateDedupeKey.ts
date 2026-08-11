function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function universityDedupeKey(name: string, country: string): string {
  return `${country.toLowerCase()}-${slugify(name)}`;
}

export function programDedupeKey(universityDedupeKey: string, programName: string, degreeLevel: string): string {
  return `${universityDedupeKey}-${slugify(degreeLevel)}-${slugify(programName)}`;
}

export function scholarshipDedupeKey(name: string, providerName: string): string {
  return `${slugify(providerName)}-${slugify(name)}`;
}
