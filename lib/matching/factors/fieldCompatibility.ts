import type { FactorScore, MatchTarget, StudentProfileForMatching } from "../types";

// Lightweight keyword -> FieldCategory heuristic, since StudentProfile
// stores desiredFields as free text (what a student types), not a
// controlled taxonomy. This deliberately stays coarse — it only needs to
// bucket a handful of common phrasings, not exhaustively classify every
// field of study.
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  STEM: ["computer", "engineering", "science", "technology", "math", "data", "physics", "biology", "chemistry"],
  BUSINESS: ["business", "management", "finance", "economics", "marketing", "administration", "mba"],
  HUMANITIES: ["history", "philosophy", "literature", "languages", "linguistics"],
  SOCIAL_SCIENCES: ["social", "psychology", "sociology", "political", "anthropology"],
  ARTS: ["art", "design", "music", "film", "media"],
  HEALTH: ["medicine", "health", "nursing", "pharmacy", "public health"],
  LAW: ["law", "legal"],
  EDUCATION: ["education", "teaching", "pedagogy"],
};

function inferCategory(text: string): string | null {
  const lower = text.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((k) => lower.includes(k))) return category;
  }
  return null;
}

export function fieldCompatibility(
  profile: StudentProfileForMatching,
  target: MatchTarget,
): FactorScore {
  if (profile.desiredFields.length === 0) {
    return {
      factor: "FIELD_COMPATIBILITY",
      score: null,
      weight: 0,
      explanation: "Add your desired fields of study to assess this factor.",
      missingProfileData: "desired fields of study",
    };
  }
  if (!target.fieldCategory) {
    return {
      factor: "FIELD_COMPATIBILITY",
      score: null,
      weight: 0,
      explanation: "No field category is stated for this opportunity.",
    };
  }

  const desiredCategories = profile.desiredFields.map((f) => inferCategory(f) ?? f.toUpperCase());
  if (desiredCategories.includes(target.fieldCategory)) {
    return {
      factor: "FIELD_COMPATIBILITY",
      score: 100,
      weight: 0,
      explanation: `Matches your interest in ${target.fieldCategory.toLowerCase().replace("_", " ")} fields.`,
    };
  }

  return {
    factor: "FIELD_COMPATIBILITY",
    score: 25,
    weight: 0,
    explanation: `This is categorized as ${target.fieldCategory.toLowerCase().replace("_", " ")}, which doesn't clearly match your stated interests (${profile.desiredFields.join(", ")}).`,
  };
}
