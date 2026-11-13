"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Web Share where available, otherwise copy the link and say so (§9.3). */
export function ShareButton({ title, className }: { title: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href.split("#")[0];
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copy this link", url);
    }
  }

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={share}
        aria-label={`Share ${title}`}
        className={cn(
          "inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-line-strong bg-white text-ink transition-colors hover:border-kick-blue hover:text-kick-blue",
          className,
        )}
      >
        {copied ? <Check aria-hidden="true" className="size-[18px] text-green-text" /> : <Share2 aria-hidden="true" className="size-[18px]" />}
      </button>
      <span role="status" className={cn("absolute top-full right-0 mt-1.5 rounded-lg bg-ink px-2.5 py-1 text-[13px] font-bold whitespace-nowrap text-white", !copied && "sr-only")}>
        {copied ? "Link copied" : ""}
      </span>
    </span>
  );
}
