"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Links are site-relative from the server; this is where they're made absolute. */
export const absoluteInviteUrl = (path: string) => (typeof window === "undefined" ? path : `${window.location.origin}${path}`);

export function CopyButton({ text, label = "Copy link" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Clipboard blocked (insecure origin); the link is on screen to copy by hand.
        }
      }}
    >
      {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
      {copied ? "Copied" : label}
    </Button>
  );
}

/** Whether an invite's email went out, as a small status label. */
export function EmailedLabel({ emailed }: { emailed: boolean }) {
  return emailed ? (
    <span className="inline-flex h-6 items-center rounded-full bg-green-tint px-2.5 text-sm font-bold text-green-text">Emailed</span>
  ) : (
    <span className="inline-flex h-6 items-center rounded-full bg-red-tint px-2.5 text-sm font-bold text-red-text">Not emailed: send the link</span>
  );
}

/**
 * Freshly made invites. Each is emailed to its student; the links are shown
 * too, once, for any email that didn't go out. The database keeps only a
 * hash, so a lost link has to be made again ("New link").
 */
export function IssuedInviteList({ invites }: { invites: Array<{ id: string; email: string; path: string; emailed: boolean }> }) {
  if (invites.length === 0) return null;
  const failed = invites.filter((i) => !i.emailed);
  const all = (failed.length ? failed : invites).map((i) => `${i.email}\t${absoluteInviteUrl(i.path)}`).join("\n");
  const summary =
    failed.length === 0
      ? `${invites.length === 1 ? "1 invite" : `${invites.length} invites`} emailed.`
      : failed.length === invites.length
        ? `${invites.length === 1 ? "The invite email" : "The invite emails"} didn't go out. Send each link to its student yourself.`
        : `${invites.length - failed.length} emailed; ${failed.length} didn't go out. Send those links yourself.`;
  return (
    <div className="mt-4 rounded-tile bg-blue-tint p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[15px] font-bold text-ink">
          {summary} The links won&rsquo;t be shown again.
        </p>
        {invites.length > 1 && <CopyButton text={all} label={failed.length ? "Copy unsent (email, link)" : "Copy all (email, link)"} />}
      </div>
      <ul className="mt-3 divide-y divide-line">
        {invites.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 font-bold text-ink">
                {i.email} <EmailedLabel emailed={i.emailed} />
              </p>
              <p className="truncate font-mono text-sm text-ink-3">{absoluteInviteUrl(i.path)}</p>
            </div>
            <CopyButton text={absoluteInviteUrl(i.path)} />
          </li>
        ))}
      </ul>
    </div>
  );
}
