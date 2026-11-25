"use client";

import { useState, useTransition } from "react";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { adminDeleteEntry, adminInviteEntry, type IssuedInvite } from "@/lib/actions/waitlist";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { absoluteInviteUrl, CopyButton, EmailedLabel } from "./invite-links";

export interface WaitlistRowData {
  id: string;
  email: string;
  degree: string | null;
  countries: string;
  nationality: string | null;
  source: string | null;
  status: "WAITING" | "INVITED" | "JOINED";
  /** Pre-formatted on the server, so the row renders the same on both sides. */
  dateLabel: string;
  inviteExpired: boolean;
}

const STATUS_STYLE: Record<WaitlistRowData["status"], string> = {
  WAITING: "bg-grey-tint text-slate",
  INVITED: "bg-blue-tint text-varsity-blue",
  JOINED: "bg-green-tint text-green-text",
};

export function WaitlistRow({ entry }: { entry: WaitlistRowData }) {
  const [pending, startTransition] = useTransition();
  const [link, setLink] = useState<IssuedInvite | null>(null);
  const [error, setError] = useState(false);
  // The list isn't refreshed after an invite (that would move the row to the
  // Invited tab and hide its link), so the row shows the new status itself.
  const status = link ? "INVITED" : entry.status;

  const invite = () =>
    startTransition(async () => {
      setError(false);
      try {
        const issued = await adminInviteEntry(entry.id);
        if (issued) setLink(issued);
        else setError(true);
      } catch {
        setError(true);
      }
    });

  return (
    <tr className="align-top">
      <td className="px-4 py-3.5">
        <p className="font-bold break-all text-ink">{entry.email}</p>
        {entry.source && <p className="text-sm text-ink-3">via {entry.source}</p>}
        {link && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <EmailedLabel emailed={link.emailed} />
            <span className="max-w-[260px] truncate font-mono text-sm text-ink-3">{absoluteInviteUrl(link.path)}</span>
            <CopyButton text={absoluteInviteUrl(link.path)} />
          </div>
        )}
        {error && <p className="mt-2 text-sm font-bold text-red-text">Couldn&rsquo;t make a link. Reload and try again.</p>}
      </td>
      <td className="px-4 py-3.5 text-sm text-ink-2">{entry.degree ?? "Not given"}</td>
      <td className="px-4 py-3.5 text-sm text-ink-2">{entry.countries || "Anywhere"}</td>
      <td className="px-4 py-3.5 text-sm text-ink-2">{entry.nationality ?? "Not given"}</td>
      <td className="px-4 py-3.5">
        <span className={cn("inline-flex h-7 items-center rounded-full px-2.5 type-caption", STATUS_STYLE[status])}>
          {link ? "Invited just now" : status === "INVITED" && entry.inviteExpired ? "Invite expired" : status.charAt(0) + status.slice(1).toLowerCase()}
        </span>
        {!link && <p className="mt-1 font-mono text-sm text-ink-3">{entry.dateLabel}</p>}
      </td>
      <td className="px-4 py-3.5">
        {status !== "JOINED" && (
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant={status === "WAITING" ? "default" : "outline"} disabled={pending} onClick={invite}>
              {status === "WAITING" ? "Invite" : "New link"}
            </Button>
            <AlertDialog.Root>
              <AlertDialog.Trigger
                render={<Button type="button" size="sm" variant="outline" disabled={pending} className="text-red-text hover:border-alert-red hover:text-red-text" />}
              >
                Delete
              </AlertDialog.Trigger>
              <AlertDialog.Portal>
                <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-night/50 data-closed:animate-out data-closed:fade-out-0 data-open:animate-in data-open:fade-in-0" />
                <AlertDialog.Popup className="fixed top-1/2 left-1/2 z-50 w-[min(440px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-panel bg-white p-6 shadow-raised outline-none">
                  <AlertDialog.Title className="font-display text-xl font-bold text-ink">Delete this entry?</AlertDialog.Title>
                  <AlertDialog.Description className="mt-2 text-[15px] text-ink-2">
                    {entry.email} and their answers are removed for good, and any invite link they have stops working.
                  </AlertDialog.Description>
                  <div className="mt-6 flex flex-wrap justify-end gap-3">
                    <AlertDialog.Close render={<Button type="button" variant="outline" />}>Cancel</AlertDialog.Close>
                    <AlertDialog.Close
                      render={<Button type="button" variant="destructive" />}
                      onClick={() => startTransition(async () => { await adminDeleteEntry(entry.id); })}
                    >
                      Delete
                    </AlertDialog.Close>
                  </div>
                </AlertDialog.Popup>
              </AlertDialog.Portal>
            </AlertDialog.Root>
          </div>
        )}
      </td>
    </tr>
  );
}
