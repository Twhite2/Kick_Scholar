import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { isCountryCode } from "@/lib/ui/country";

/**
 * An SVG flag from flag-icons (Windows doesn't render flag emoji). Always
 * decorative: the country name is printed next to it (§6.2).
 */
export function CountryFlag({
  code,
  size = "sm",
  tone = "light",
  className,
}: {
  code: string | null | undefined;
  size?: "sm" | "tile";
  tone?: "light" | "night";
  className?: string;
}) {
  if (!isCountryCode(code)) {
    return (
      <Globe
        aria-hidden="true"
        className={cn("shrink-0", tone === "night" ? "text-on-night-muted" : "text-ink-3", className)}
        style={{ width: size === "tile" ? 18 : 16, height: size === "tile" ? 18 : 16 }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      data-tone={tone}
      className={cn("ks-flag", `fi-${code.toLowerCase()}`, className)}
      style={size === "tile" ? { width: 22, height: 16 } : undefined}
    />
  );
}
