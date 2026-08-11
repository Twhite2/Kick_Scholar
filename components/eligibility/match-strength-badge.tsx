import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { MatchStrength } from "@/lib/generated/prisma/enums";

const CONFIG: Record<MatchStrength, { label: string; className: string }> = {
  STRONG_MATCH: { label: "Strong Match", className: "bg-success/10 text-success" },
  LIKELY_ELIGIBLE: { label: "Likely Eligible", className: "bg-success/10 text-success" },
  POTENTIAL_MATCH: { label: "Potential Match", className: "bg-primary/10 text-primary" },
  NEEDS_VERIFICATION: { label: "Needs Verification", className: "bg-muted text-muted-foreground" },
  MISSING_REQUIREMENT: { label: "Missing Requirement", className: "bg-destructive/10 text-destructive" },
};

export function MatchStrengthBadge({ strength, className }: { strength: MatchStrength; className?: string }) {
  const config = CONFIG[strength];
  return <Badge className={cn(config.className, className)}>{config.label}</Badge>;
}
