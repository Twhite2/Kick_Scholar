import type { FactorScore } from "./types";

export interface Explanation {
  strengths: string[];
  missingRequirements: string[];
  warnings: string[];
  recommendedActions: string[];
}

const ACTION_VERBS: Record<string, string> = {
  GPA: "Add your GPA to your profile",
  "current education level": "Add your current education level to your profile",
  "desired fields of study": "Tell us which fields you're interested in",
  budget: "Add your budget to your profile",
  "work experience": "Add your work experience to your profile",
};

export function explain(factorScores: FactorScore[]): Explanation {
  const strengths: string[] = [];
  const missingRequirements: string[] = [];
  const warnings: string[] = [];
  const recommendedActions: string[] = [];

  for (const f of factorScores) {
    if (f.hardFail) {
      missingRequirements.push(f.explanation);
      continue;
    }
    if (f.score !== null && f.score >= 80) {
      strengths.push(f.explanation);
    }
    if (f.score === 0 && f.missingProfileData) {
      missingRequirements.push(f.explanation);
      const known = ACTION_VERBS[f.missingProfileData];
      recommendedActions.push(known ?? `Add your ${f.missingProfileData} to your profile`);
    } else if (f.score === null && f.missingProfileData) {
      const known = ACTION_VERBS[f.missingProfileData];
      recommendedActions.push(known ?? `Add your ${f.missingProfileData} to your profile`);
    }
    if (f.score !== null && f.score < 80 && !f.hardFail && /verify/i.test(f.explanation)) {
      warnings.push(f.explanation);
    }
  }

  return {
    strengths: [...new Set(strengths)],
    missingRequirements: [...new Set(missingRequirements)],
    warnings: [...new Set(warnings)],
    recommendedActions: [...new Set(recommendedActions)],
  };
}
