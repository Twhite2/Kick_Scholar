"use client";

import { useTransition } from "react";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { adminRecheckScholarship, adminMarkVerified, adminMarkRejected } from "@/lib/actions/admin";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { humanise } from "@/lib/ui/text";


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
    <tr className="align-top">
      <td className="px-4 py-3.5">
        <p className="font-bold text-ink">{scholarship.name}</p>
        <p className="text-sm text-ink-3">{scholarship.providerName}</p>
      </td>
      <td className="px-4 py-3.5">
        <span
          className={cn(
            "inline-flex h-7 items-center rounded-full px-2.5 type-caption",
            scholarship.authorityLevel === "PRIMARY" ? "bg-green-tint text-green-text" : "bg-grey-tint text-slate",
          )}
        >
          {humanise(scholarship.authorityLevel)}
        </span>
      </td>
      <td className="px-4 py-3.5">
        <span
          className={cn(
            "inline-flex h-7 items-center rounded-full px-2.5 type-caption",
            scholarship.verificationStatus === "CONFLICTING" ? "bg-red-tint text-red-text" : "bg-grey-tint text-slate",
          )}
        >
          {humanise(scholarship.verificationStatus)}
        </span>
      </td>
      <td className="px-4 py-3.5">
        {scholarship.officialSourceUrl ? (
          <a
            href={scholarship.officialSourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block max-w-[240px] truncate font-mono text-sm text-kick-blue hover:underline"
          >
            {scholarship.officialSourceUrl}
          </a>
        ) : (
          <span className="text-sm text-ink-3">None cited</span>
        )}
      </td>
      <td className="px-4 py-3.5">
        <div className="flex flex-wrap gap-2">
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
          {/* Rejecting removes it from the queue, so it asks first (§9.12). */}
          <AlertDialog.Root>
            <AlertDialog.Trigger render={<Button type="button" size="sm" variant="outline" disabled={isPending} className="text-red-text hover:border-kick-red hover:text-red-text" />}>
              Reject
            </AlertDialog.Trigger>
            <AlertDialog.Portal>
              <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-night/50 data-closed:animate-out data-closed:fade-out-0 data-open:animate-in data-open:fade-in-0" />
              <AlertDialog.Popup className="fixed top-1/2 left-1/2 z-50 w-[min(440px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-panel bg-white p-6 shadow-raised outline-none">
                <AlertDialog.Title className="font-display text-xl font-bold text-ink">Reject this scholarship?</AlertDialog.Title>
                <AlertDialog.Description className="mt-2 text-[15px] text-ink-2">
                  It will leave the queue. &ldquo;{scholarship.name}&rdquo;
                </AlertDialog.Description>
                <div className="mt-6 flex flex-wrap justify-end gap-3">
                  <AlertDialog.Close render={<Button type="button" variant="outline" />}>Cancel</AlertDialog.Close>
                  <AlertDialog.Close
                    render={<Button type="button" variant="destructive" />}
                    onClick={() => startTransition(async () => { await adminMarkRejected(scholarship.id); })}
                  >
                    Reject
                  </AlertDialog.Close>
                </div>
              </AlertDialog.Popup>
            </AlertDialog.Portal>
          </AlertDialog.Root>
        </div>
      </td>
    </tr>
  );
}
