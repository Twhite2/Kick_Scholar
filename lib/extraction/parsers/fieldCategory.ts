/**
 * Coarse keyword -> FieldCategory heuristic.
 *
 * Extracted from lib/matching/factors/fieldCompatibility.ts so the extraction
 * pipeline and the matching engine bucket text the same way — two divergent
 * copies would mean a programme could be stored as STEM but matched as OTHER.
 *
 * Deliberately coarse: it buckets common phrasings, it does not exhaustively
 * classify every field of study. Callers must treat a null return as "not
 * determined" rather than silently substituting a default.
 */
export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  STEM: [
    "computer", "computing", "informatics", "engineering", "science", "technology",
    "mathematic", "data", "physics", "biology", "chemistry", "robotic", "software",
  ],
  BUSINESS: [
    "business", "management", "finance", "economic", "marketing", "administration",
    "mba", "accounting", "logistics",
  ],
  HUMANITIES: [
    "history", "philosophy", "literature", "linguistic", "cultural", "theology",
    "language studies", "european studies",
  ],
  SOCIAL_SCIENCES: [
    "social", "psychology", "sociology", "political", "anthropology",
    "international relations", "development studies",
  ],
  ARTS: ["design", "music", "film", "media", "architecture", "fine art", "visual art", "performing art"],
  HEALTH: ["medicine", "medical", "health", "nursing", "pharmac", "dentistry"],
  LAW: ["law", "legal", "juris"],
  EDUCATION: ["education", "teaching", "pedagog"],
};

/**
 * Degree designations that appear in programme titles and would otherwise be
 * mistaken for the field itself.
 *
 * Real case: "Bachelor of Arts in European Studies" was classified ARTS
 * because of the degree name, not the subject — a confidently wrong answer,
 * which is worse than returning null. Stripping the designation first leaves
 * "in European Studies" to classify.
 */
const DEGREE_DESIGNATIONS =
  /\b(bachelor|master|doctor|doctoral|phd)\s+of\s+[a-z]+(\s+[a-z]+)?\b|\b(b\.?sc|m\.?sc|b\.?a|m\.?a|m\.?eng|b\.?eng|mba|llm|llb)\b/gi;

export function inferFieldCategory(text: string): string | null {
  const cleaned = text.replace(DEGREE_DESIGNATIONS, " ").toLowerCase();

  // Longest keyword first, so "european studies" beats a stray "art".
  const ranked = Object.entries(CATEGORY_KEYWORDS)
    .flatMap(([category, keywords]) => keywords.map((k) => ({ category, k })))
    .sort((a, b) => b.k.length - a.k.length);

  for (const { category, k } of ranked) {
    if (cleaned.includes(k)) return category;
  }
  return null;
}
