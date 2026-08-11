import type { RequirementOperator } from "../generated/prisma/enums";

/** Evaluates a numeric requirement/eligibility operator. null = can't assess (missing data). */
export function compareNumeric(
  operator: RequirementOperator,
  requiredValue: number,
  actualValue: number | null,
): boolean | null {
  if (actualValue === null || Number.isNaN(actualValue)) return null;
  switch (operator) {
    case "GTE":
      return actualValue >= requiredValue;
    case "LTE":
      return actualValue <= requiredValue;
    case "GT":
      return actualValue > requiredValue;
    case "LT":
      return actualValue < requiredValue;
    case "EQ":
      return actualValue === requiredValue;
    default:
      return null;
  }
}

/** Evaluates a set-membership requirement (e.g. "nationality in [...]"). */
export function compareSetMembership(valueList: string[], actualValue: string | null): boolean | null {
  if (actualValue === null || valueList.length === 0) return null;
  const normalized = actualValue.trim().toLowerCase();
  return valueList.some((v) => v.trim().toLowerCase() === normalized);
}
