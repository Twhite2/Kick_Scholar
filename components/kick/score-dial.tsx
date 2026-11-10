import { cn } from "@/lib/utils";
import { STRENGTH_ACCENT, STRENGTH_ACCENT_NIGHT, dialLabel, type Strength } from "@/lib/ui/strength";

const GEOMETRY = {
  46: { r: 18, stroke: 4, font: 15 },
  60: { r: 25, stroke: 5, font: 21 },
  88: { r: 37, stroke: 6, font: 30 },
} as const;

export type DialSize = keyof typeof GEOMETRY;

/**
 * The match score as a ring (docs/ui-remodel.md §6.4). Colour is never the
 * only signal: the number is printed and the accessible name says the
 * strength in words.
 */
export function ScoreDial({
  score,
  strength,
  size,
  tone = "light",
  animate = true,
  className,
}: {
  score: number;
  strength: Strength;
  size: DialSize;
  tone?: "light" | "night";
  animate?: boolean;
  className?: string;
}) {
  const { r, stroke, font } = GEOMETRY[size];
  const c = size / 2;
  const value = Math.max(0, Math.min(100, Math.round(score)));
  const accent = tone === "night" ? STRENGTH_ACCENT_NIGHT[strength] : STRENGTH_ACCENT[strength];

  return (
    <div
      role="img"
      aria-label={dialLabel(value, strength)}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-full",
        tone === "light" && "bg-white shadow-tile-on-image",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0" aria-hidden="true">
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          strokeWidth={stroke}
          stroke={tone === "night" ? "var(--on-night-line)" : "var(--track)"}
        />
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          strokeWidth={stroke}
          stroke={accent}
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${value} 100`}
          transform={`rotate(-90 ${c} ${c})`}
          className="ks-dial-arc"
          data-animate={animate ? "true" : "false"}
        />
      </svg>
      <span
        aria-hidden="true"
        className={cn(
          "relative font-display leading-none font-[750] tabular-nums",
          tone === "night" ? "text-white" : "text-ink",
        )}
        style={{ fontSize: font }}
      >
        {value}
      </span>
    </div>
  );
}
