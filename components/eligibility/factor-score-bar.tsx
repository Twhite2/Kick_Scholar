import { Mono } from "@/components/ui/mono";
import { cn } from "@/lib/utils";

const FACTOR_LABELS: Record<string, string> = {
  ACADEMIC_COMPATIBILITY: "Academic Fit",
  DEGREE_COMPATIBILITY: "Degree Fit",
  FIELD_COMPATIBILITY: "Field Fit",
  COUNTRY_PREFERENCE: "Country Fit",
  LANGUAGE_COMPATIBILITY: "Language Fit",
  BUDGET_COMPATIBILITY: "Budget Fit",
  SCHOLARSHIP_ELIGIBILITY: "Scholarship Eligibility",
  WORK_EXPERIENCE: "Experience Fit",
};

export function FactorScoreBar({
  factor,
  score,
  explanation,
}: {
  factor: string;
  score: number | null;
  explanation: string;
}) {
  const color = score === null ? "bg-border" : score >= 70 ? "bg-success" : score >= 40 ? "bg-primary" : "bg-destructive";

  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{FACTOR_LABELS[factor] ?? factor}</span>
        <Mono className={cn("text-xs", score === null && "text-muted-foreground")}>
          {score === null ? "N/A" : `${score}%`}
        </Mono>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-alt">
        <div
          className={cn("h-full rounded-full transition-[width] duration-700 ease-out", color)}
          style={{ width: `${score ?? 0}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{explanation}</p>
    </div>
  );
}
