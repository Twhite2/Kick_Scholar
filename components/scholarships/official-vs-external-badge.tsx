import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Globe } from "lucide-react";

/**
 * Trust-critical: visually distinguishes a verified, officially-sourced
 * scholarship from one that was only discovered via an aggregator and not
 * yet independently confirmed. Never presented identically to an official
 * scholarship — see the product's core "never say you're eligible without
 * genuine source support" principle.
 */
export function OfficialVsExternalBadge({ verified }: { verified: boolean }) {
  if (verified) {
    return (
      <Badge className="gap-1 bg-success/10 text-success">
        <ShieldCheck className="size-3" /> Verified source
      </Badge>
    );
  }
  return (
    <Badge className="gap-1 bg-muted text-muted-foreground">
      <Globe className="size-3" /> External — needs verification
    </Badge>
  );
}
