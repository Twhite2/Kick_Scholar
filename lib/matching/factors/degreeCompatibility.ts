import type { DegreeLevel } from "../../generated/prisma/enums";
import type { FactorScore, MatchTarget, StudentProfileForMatching } from "../types";

const DEGREE_RANK: Record<DegreeLevel, number> = {
  HIGH_SCHOOL: 0,
  CERTIFICATE: 1,
  DIPLOMA: 1,
  BACHELOR: 2,
  MASTER: 3,
  PHD: 4,
  OTHER: -1,
};

/** What level of prior education a given target degree level normally requires. */
const PREREQUISITE_RANK: Partial<Record<DegreeLevel, number>> = {
  BACHELOR: DEGREE_RANK.HIGH_SCHOOL,
  MASTER: DEGREE_RANK.BACHELOR,
  PHD: DEGREE_RANK.MASTER,
};

export function degreeCompatibility(
  profile: StudentProfileForMatching,
  target: MatchTarget,
): FactorScore {
  if (!target.degreeLevel) {
    return {
      factor: "DEGREE_COMPATIBILITY",
      score: null,
      weight: 0,
      explanation: "Degree level is not stated for this opportunity.",
    };
  }

  const prereqRank = PREREQUISITE_RANK[target.degreeLevel];
  if (prereqRank !== undefined) {
    if (profile.currentEducationLevel === null) {
      return {
        factor: "DEGREE_COMPATIBILITY",
        score: null,
        weight: 0,
        explanation: "Add your current education level to assess this factor.",
        missingProfileData: "current education level",
      };
    }
    const studentRank = DEGREE_RANK[profile.currentEducationLevel];
    if (studentRank < prereqRank) {
      return {
        factor: "DEGREE_COMPATIBILITY",
        score: 0,
        weight: 0,
        hardFail: true,
        explanation: `This ${target.degreeLevel.toLowerCase()}-level opportunity normally requires a completed prior degree you don't yet have on your profile.`,
      };
    }
  }

  const interestMatch = profile.desiredDegreeLevel === null || profile.desiredDegreeLevel === target.degreeLevel;
  return {
    factor: "DEGREE_COMPATIBILITY",
    score: interestMatch ? 100 : 60,
    weight: 0,
    explanation: interestMatch
      ? `Matches the ${target.degreeLevel.toLowerCase()} level you're looking for.`
      : `This is a ${target.degreeLevel.toLowerCase()}-level opportunity; you indicated interest in ${profile.desiredDegreeLevel?.toLowerCase()}.`,
  };
}
