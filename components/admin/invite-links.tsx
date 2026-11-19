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

/**
 * Freshly made invite links. They are shown only now: the database keeps a
 * hash, so a link that is lost has to be made again ("New link").
 */
export function IssuedInviteList({ invites }: { invites: Array<{ id: string; email: string; path: string }> }) {
  if (invites.length === 0) return null;
  const all = invites.map((i) => `${i.email}\t${absoluteInviteUrl(i.path)}`).join("\n");
  return (
    <div className="mt-4 rounded-tile bg-blue-tint p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[15px] font-bold text-ink">
          {invites.length === 1 ? "1 invite link" : `${invites.length} invite links`}. Send each one to its student. They
          won&rsquo;t be shown again.
        </p>
        {invites.length > 1 && <CopyButton text={all} label="Copy all (email, link)" />}
      </div>
      <ul className="mt-3 divide-y divide-line">
        {invites.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="font-bold text-ink">{i.email}</p>
              <p className="truncate font-mono text-sm text-ink-3">{absoluteInviteUrl(i.path)}</p>
            </div>
            <CopyButton text={absoluteInviteUrl(i.path)} />
          </li>
        ))}
      </ul>
    </div>
  );
}
