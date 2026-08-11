import { Mono } from "@/components/ui/mono";

export function ProfileCompletionRing({ completeness }: { completeness: number }) {
  const percent = Math.round(completeness * 100);
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - completeness);
  const color = percent >= 80 ? "var(--success)" : percent >= 40 ? "var(--primary)" : "var(--muted-foreground)";

  return (
    <div className="relative flex size-24 items-center justify-center">
      <svg viewBox="0 0 80 80" className="size-24 -rotate-90">
        <circle cx="40" cy="40" r={radius} fill="none" stroke="var(--border)" strokeWidth="8" />
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <Mono className="text-lg font-semibold">{percent}%</Mono>
        <span className="text-[10px] text-muted-foreground">complete</span>
      </div>
    </div>
  );
}
