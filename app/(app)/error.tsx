"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isNightRoute } from "@/lib/ui/nav";
import { cn } from "@/lib/utils";

/** App-wide error boundary (docs/ui-remodel.md §7.5). */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const pathname = usePathname() ?? "";
  const night = isNightRoute(pathname);

  useEffect(() => {
    console.error("[ui] page failed to render", error.digest ?? "", error);
  }, [error]);

  return (
    <div className={cn(night && "bg-night pt-16 md:pt-20")}>
      <section
        aria-labelledby="error-title"
        className={cn("mx-auto flex max-w-xl flex-col items-start gap-4 px-gutter py-16 md:py-24", night && "text-white")}
      >
        <CircleAlert aria-hidden="true" className={cn("size-8", night ? "text-on-night-danger" : "text-kick-red")} />
        <h1 id="error-title" className="type-page-h1">
          This page didn&apos;t load
        </h1>
        <p className={cn("text-base", night ? "text-on-night-muted" : "text-ink-3")}>
          Something went wrong on our side. Try again, or go back to Home.
        </p>
        {error.digest && (
          <p className={cn("text-[13px]", night ? "text-on-night-muted" : "text-ink-3")}>Reference: {error.digest}</p>
        )}
        <div className="flex flex-wrap gap-3">
          <Button size="lg" variant={night ? "white" : "default"} onClick={() => reset()}>
            Try again
          </Button>
          <Button size="lg" variant={night ? "outlineNight" : "outline"} render={<Link href="/dashboard" />}>
            Go to Home
          </Button>
        </div>
      </section>
    </div>
  );
}
