import Link from "next/link";
import { cn } from "@/lib/utils";
import type { InstitutionFace } from "@/lib/types/cards";
import { InstitutionLogo } from "../institution-logo";
import { CountryFlag } from "../country-flag";
import { countryName } from "@/lib/ui/country";

/**
 * Where a scholarship can be used, split by how we know it (§9.4). An
 * EXPLICIT_SOURCE row is a citable fact; a RULE_INFERENCE row is the
 * product's own reasoning and always carries the rule that produced it, so
 * the two never share a heading.
 */

export interface WhereRow {
  id: string;
  programme: { id: string; name: string } | null;
  institution: InstitutionFace | null;
}

const PREVIEW = 8;

function Row({ row }: { row: WhereRow }) {
  const inst = row.institution;
  const body = (
    <>
      {inst && <InstitutionLogo name={inst.name} logoUrl={inst.logoUrl} acronym={inst.acronym} seed={inst.id} size={40} />}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-bold text-ink">{row.programme?.name ?? inst?.name ?? "Unknown institution"}</span>
        <span className="flex items-center gap-1.5 truncate text-sm text-ink-3">
          {row.programme && inst ? (
            inst.name
          ) : inst ? (
            <>
              <CountryFlag code={inst.countryCode} />
              {[inst.city, countryName(inst.countryCode)].filter(Boolean).join(", ")}
            </>
          ) : null}
        </span>
      </span>
      <span className="shrink-0 rounded-full bg-grey-tint px-2.5 py-1 type-caption text-slate">
        {row.programme ? "Programme" : "University"}
      </span>
    </>
  );
  const href = row.programme ? `/programs/${row.programme.id}` : inst ? `/institutions/${inst.id}` : null;
  const className = "flex min-h-[64px] items-center gap-3 rounded-tile bg-white px-3.5 py-2.5 shadow-hairline";
  return href ? (
    <Link href={href} className={cn(className, "transition-shadow hover:shadow-preview")}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

export function WhereUsed({
  explicit,
  inferred,
  explicitTotal,
  inferredTotal,
  rule,
}: {
  explicit: WhereRow[];
  inferred: WhereRow[];
  explicitTotal: number;
  inferredTotal: number;
  rule: { countries?: string[]; degreeLevels?: string[]; fieldCategories?: string[] } | null;
}) {
  if (explicit.length === 0 && inferred.length === 0) {
    return (
      <p className="text-[15px] text-ink-3">
        No institutions linked yet. This scholarship&apos;s eligibility rules are still applied to your profile when matching.
      </p>
    );
  }

  const ruleParts = [
    rule?.countries?.length ? rule.countries.join(", ") : null,
    rule?.degreeLevels?.length ? rule.degreeLevels.join(", ").toLowerCase() : null,
    rule?.fieldCategories?.length ? rule.fieldCategories.join(", ").toLowerCase() : null,
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-8">
      {explicit.length > 0 && (
        <div>
          <h3 className="text-base font-bold text-ink">Officially linked to</h3>
          <p className="mt-0.5 text-sm text-ink-3">Named directly by the source.</p>
          <ul role="list" className="mt-3 grid grid-cols-1 gap-2.5 md:grid-cols-2">
            {explicit.slice(0, PREVIEW).map((r) => (
              <li key={r.id}>
                <Row row={r} />
              </li>
            ))}
          </ul>
          {explicitTotal > PREVIEW && (
            <p className="mt-2.5 text-sm text-ink-3">and {(explicitTotal - PREVIEW).toLocaleString("en-GB")} more</p>
          )}
        </div>
      )}
      {inferred.length > 0 && (
        <div>
          <h3 className="text-base font-bold text-ink">May apply to</h3>
          <p className="mt-0.5 max-w-[70ch] text-sm text-ink-3">
            Worked out from this scholarship&apos;s own stated rules
            {ruleParts.length > 0 ? ` (${ruleParts.join(" · ")})` : ""} — not confirmed by the provider. Check with the
            institution before applying.
          </p>
          <ul role="list" className="mt-3 grid grid-cols-1 gap-2.5 md:grid-cols-2">
            {inferred.slice(0, PREVIEW).map((r) => (
              <li key={r.id}>
                <Row row={r} />
              </li>
            ))}
          </ul>
          {inferredTotal > PREVIEW && (
            <p className="mt-2.5 text-sm text-ink-3">
              and {(inferredTotal - PREVIEW).toLocaleString("en-GB")} more matching the same rule
            </p>
          )}
        </div>
      )}
    </div>
  );
}
