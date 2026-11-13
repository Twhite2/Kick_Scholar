import Link from "next/link";
import { KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UnlockData } from "@/lib/types/cards";

/**
 * The biggest fixable gap, overlapping the billboard (docs/ui-remodel.md
 * §9.1.2). Its buttons deep-link to the profile section that fixes it.
 */
export function UnlockCard({ unlock, className }: { unlock: UnlockData; className?: string }) {
  return (
    <section
      aria-labelledby="unlock-title"
      className={cn(
        "relative z-[4] mx-gutter flex max-w-[1120px] flex-col gap-4 rounded-feature bg-white px-5 py-5 shadow-raised md:flex-row md:flex-wrap md:items-center md:px-6",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-4 md:flex-[1_1_380px] md:items-center">
        <span
          aria-hidden="true"
          className="inline-flex size-[52px] shrink-0 items-center justify-center rounded-[14px] bg-blue-tint"
        >
          <KeyRound className="size-[26px] text-kick-blue" />
        </span>
        <div className="min-w-0">
          <h2 id="unlock-title" className="text-lg leading-snug font-bold text-ink">
            {unlock.title}
          </h2>
          <p className="mt-1 type-body-sm text-ink-3">{unlock.body}</p>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row md:shrink-0">
        <Link
          href={unlock.primary.href}
          className="inline-flex h-12 items-center justify-center rounded-full bg-kick-blue px-6 text-base font-bold text-white hover:bg-kick-blue-hover"
        >
          {unlock.primary.label}
        </Link>
        {unlock.secondary && (
          <Link
            href={unlock.secondary.href}
            className="inline-flex h-12 items-center justify-center rounded-full border border-line-strong bg-white px-6 text-base font-bold text-ink hover:border-kick-blue hover:text-kick-blue"
          >
            {unlock.secondary.label}
          </Link>
        )}
      </div>
    </section>
  );
}
