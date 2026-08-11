"use client";

import { useTransition } from "react";
import { adminRecheckScholarship, adminMarkVerified, adminMarkRejected } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mono } from "@/components/ui/mono";

export function VerificationQueueRow({
  scholarship,
}: {
  scholarship: {
    id: string;
    name: string;
    providerName: string;
    authorityLevel: string;
    verificationStatus: string;
    discoveryUrl: string | null;
    officialSourceUrl: string | null;
  };
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <tr>
      <td className="px-4 py-3">
        <p className="font-medium">{scholarship.name}</p>
        <p className="text-xs text-muted-foreground">{scholarship.providerName}</p>
      </td>
      <td className="px-4 py-3">
        <Badge variant={scholarship.authorityLevel === "PRIMARY" ? "secondary" : "outline"}>
          {scholarship.authorityLevel}
        </Badge>
      </td>
      <td className="px-4 py-3">
        <Badge
          className={
            scholarship.verificationStatus === "CONFLICTING"
              ? "bg-destructive/10 text-destructive"
              : "bg-muted text-muted-foreground"
          }
        >
          {scholarship.verificationStatus}
        </Badge>
      </td>
      <td className="px-4 py-3">
        {scholarship.officialSourceUrl ? (
          <Mono className="block max-w-[220px] truncate text-xs text-kick-blue">
            {scholarship.officialSourceUrl}
          </Mono>
        ) : (
          <span className="text-xs text-muted-foreground">None cited</span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => startTransition(async () => { await adminRecheckScholarship(scholarship.id); })}
          >
            Re-check
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={isPending}
            onClick={() => startTransition(async () => { await adminMarkVerified(scholarship.id); })}
          >
            Verify
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={isPending}
            onClick={() => startTransition(async () => { await adminMarkRejected(scholarship.id); })}
          >
            Reject
          </Button>
        </div>
      </td>
    </tr>
  );
}
