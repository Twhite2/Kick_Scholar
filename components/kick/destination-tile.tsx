import Link from "next/link";
import { countryName, destinationScene } from "@/lib/ui/country";
import { plural } from "@/lib/ui/format";
import { CoverImage } from "./cover-image";
import { CountryFlag } from "./country-flag";

/** A country to browse, drawn with its scene so the rail stays calm (§9.1.6). */
export function DestinationTile({
  countryCode,
  count,
  personalised = true,
}: {
  countryCode: string;
  count: number;
  personalised?: boolean;
}) {
  const name = countryName(countryCode);
  return (
    <Link
      href={`/programs?country=${encodeURIComponent(countryCode)}`}
      className="group/dest relative block h-[128px] w-[180px] overflow-hidden rounded-tile shadow-hairline md:h-[148px] md:w-[220px]"
    >
      <CoverImage
        institutionId={countryCode}
        countryCode={countryCode}
        scene={destinationScene(countryCode)}
        sizes="220px"
        className="transition-transform duration-300 can-hover:group-hover/dest:scale-[1.03]"
      />
      <span className="absolute inset-x-0 bottom-0 bg-[rgba(7,29,51,.8)] px-3.5 py-2.5">
        <span className="flex items-center gap-2 text-base font-bold text-white">
          <CountryFlag code={countryCode} size="tile" tone="night" />
          <span className="truncate">{name}</span>
        </span>
        <span className="block text-[13px] text-[#C9D6E4] tabular-nums">
          {personalised ? `${plural(count, "match", "matches")} for you` : plural(count, "programme")}
        </span>
      </span>
    </Link>
  );
}
