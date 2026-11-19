import { TARGET_COUNTRIES } from "@/lib/constants/countries";
import { countryName, countryNameOptions } from "@/lib/ui/country";
import { ISO_COUNTRY_CODES } from "@/lib/ui/iso-countries";

/** What the waitlist form needs from the server: its pick lists and where the visitor came from. */
export function waitlistFormProps(params: Record<string, string | string[] | undefined>) {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  return {
    countries: Object.keys(TARGET_COUNTRIES)
      .map((code) => ({ code, name: countryName(code) }))
      .sort((a, b) => a.name.localeCompare(b.name, "en-GB")),
    nationalities: countryNameOptions(ISO_COUNTRY_CODES),
    source: first(params.utm_source) ?? first(params.ref) ?? null,
  };
}
