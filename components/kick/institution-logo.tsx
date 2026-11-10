import { cn } from "@/lib/utils";
import { monogramColor, monogramScale, monogramText } from "@/lib/ui/monogram";
import { LogoImage } from "./logo-image";

export type LogoSize = 32 | 40 | 44 | 46 | 52 | 56 | 64 | 72;

/** ≈27% of the tile (§5.4). */
const RADIUS: Record<LogoSize, number> = { 32: 9, 40: 11, 44: 12, 46: 13, 52: 14, 56: 15, 64: 17, 72: 18 };

export interface InstitutionLogoProps {
  /** Always printed next to the tile, so the tile itself is decorative. */
  name: string;
  /** Our cached URL (§11). Never a third-party origin. */
  logoUrl?: string | null;
  acronym?: string | null;
  /** Institution id: a stable seed for the monogram colour. */
  seed: string;
  size: LogoSize;
  surface?: "image" | "white";
  className?: string;
}

function Monogram({ name, acronym, seed, size }: Pick<InstitutionLogoProps, "name" | "acronym" | "seed" | "size">) {
  const text = monogramText(name, acronym);
  return (
    <span
      className="font-display leading-none font-[750] tracking-[-0.02em] tabular-nums select-none"
      style={{ color: monogramColor(seed), fontSize: Math.round(size * monogramScale(text)) }}
    >
      {text}
    </span>
  );
}

/**
 * A white tile with the institution's logo, or its monogram when there is no
 * logo or it fails to load (docs/ui-remodel.md §6.1). Logos are only ever
 * scaled and padded — never recoloured or cropped (§11.5).
 */
export function InstitutionLogo({
  name,
  logoUrl,
  acronym,
  seed,
  size,
  surface = "white",
  className,
}: InstitutionLogoProps) {
  const monogram = <Monogram name={name} acronym={acronym} seed={seed} size={size} />;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden bg-white",
        surface === "image" ? "shadow-tile-on-image" : "shadow-tile-on-white",
        className,
      )}
      style={{ width: size, height: size, borderRadius: RADIUS[size] }}
    >
      {logoUrl ? (
        <LogoImage src={logoUrl} size={size} padding={Math.round(size * 0.14)} fallback={monogram} />
      ) : (
        monogram
      )}
    </span>
  );
}
