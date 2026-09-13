import Link from "next/link";
import { Badge } from "@/components/ui/badge";

/**
 * Where a scholarship can be used, split by how we know it.
 *
 * The split is the whole point. An EXPLICIT_SOURCE row is a citable fact: a
 * page named this institution. A RULE_INFERENCE row is the product's own
 * reasoning — the scholarship said "state-recognised universities in Germany"
 * and we expanded that across the catalogue. Presenting the second as the
 * first would quietly break the promise that every claim traces to a source,
 * so they never share a heading, and inferred links always carry the rule that
 * produced them.
 */

export interface ApplicableLink {
  id: string;
  linkMethod: "EXPLICIT_SOURCE" | "RULE_INFERENCE";
  fundingType: string;
  programId: string | null;
  universityId: string | null;
  program: { name: string; university: { name: string } | null } | null;
  university: { name: string } | null;
}

/** Enough to show the shape of the answer without an endless wall of rows. */
const PREVIEW_LIMIT = 8;

function targetHref(link: ApplicableLink): string | null {
  // A university-level link has no programme. Linking it to /programs/null was
  // the old behaviour and produced a dead route.
  if (link.programId) return `/programs/${link.programId}`;
  return null;
}

function targetLabel(link: ApplicableLink): { title: string; subtitle: string | null } {
  if (link.program) {
    return { title: link.program.name, subtitle: link.program.university?.name ?? null };
  }
  return { title: link.university?.name ?? "Unknown institution", subtitle: null };
}

function LinkRow({ link }: { link: ApplicableLink }) {
  const { title, subtitle } = targetLabel(link);
  const href = targetHref(link);
  const body = (
    <>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{title}</p>
        {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <Badge variant={link.linkMethod === "EXPLICIT_SOURCE" ? "secondary" : "outline"}>
        {link.programId ? "Programme" : "Institution"}
      </Badge>
    </>
  );

  const className =
    "flex items-center justify-between gap-3 rounded-xl border border-border p-3 text-sm";

  return href ? (
    <Link href={href} className={`${className} transition-colors hover:bg-muted`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

export function ApplicableInstitutions({
  links,
  rule,
}: {
  links: ApplicableLink[];
  /** The eligibility rule the inferred links were expanded from. */
  rule?: { countries?: string[]; degreeLevels?: string[]; fieldCategories?: string[] } | null;
}) {
  const explicit = links.filter((l) => l.linkMethod === "EXPLICIT_SOURCE");
  const inferred = links.filter((l) => l.linkMethod === "RULE_INFERENCE");

  if (explicit.length === 0 && inferred.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No institutions linked yet. This scholarship&apos;s eligibility rules are still applied to
        your profile when matching.
      </p>
    );
  }

  const ruleParts = [
    rule?.countries?.length ? rule.countries.join(", ") : null,
    rule?.degreeLevels?.length ? rule.degreeLevels.join(", ").toLowerCase() : null,
    rule?.fieldCategories?.length ? rule.fieldCategories.join(", ").toLowerCase() : null,
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-5">
      {explicit.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold">Officially linked to</h4>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Named directly by the source.
          </p>
          <div className="mt-2 space-y-2">
            {explicit.slice(0, PREVIEW_LIMIT).map((l) => (
              <LinkRow key={l.id} link={l} />
            ))}
          </div>
          {explicit.length > PREVIEW_LIMIT && (
            <p className="mt-2 text-xs text-muted-foreground">
              and {explicit.length - PREVIEW_LIMIT} more
            </p>
          )}
        </div>
      )}

      {inferred.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold">May apply to</h4>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Worked out from this scholarship&apos;s own stated rules
            {ruleParts.length > 0 ? ` (${ruleParts.join(" · ")})` : ""} — not confirmed by the
            provider. Check with the institution before applying.
          </p>
          <div className="mt-2 space-y-2">
            {inferred.slice(0, PREVIEW_LIMIT).map((l) => (
              <LinkRow key={l.id} link={l} />
            ))}
          </div>
          {inferred.length > PREVIEW_LIMIT && (
            <p className="mt-2 text-xs text-muted-foreground">
              and {inferred.length - PREVIEW_LIMIT} more matching the same rule
            </p>
          )}
        </div>
      )}
    </div>
  );
}
