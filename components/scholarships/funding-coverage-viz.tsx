import { Mono } from "@/components/ui/mono";

const COVERAGE_PERCENT: Record<string, number> = {
  FULL_FUNDING: 100,
  FULL_TUITION: 85,
  PARTIAL_TUITION: 50,
  STIPEND: 30,
  TRAVEL: 15,
  VARIES: 50,
  UNKNOWN: 0,
};

const COVERAGE_LABEL: Record<string, string> = {
  FULL_FUNDING: "Full funding",
  FULL_TUITION: "Full tuition",
  PARTIAL_TUITION: "Partial tuition",
  STIPEND: "Stipend",
  TRAVEL: "Travel only",
  VARIES: "Varies",
  UNKNOWN: "Not published",
};

export function FundingCoverageViz({ coverageType }: { coverageType: string }) {
  const percent = COVERAGE_PERCENT[coverageType] ?? 0;
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">Coverage</span>
        <Mono className="text-xs text-muted-foreground">{COVERAGE_LABEL[coverageType] ?? coverageType}</Mono>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-alt">
        <div
          className="h-full rounded-full bg-kick-green transition-[width] duration-700 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
