import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** "We can't find that programme" with a way back to the catalogue (§7.5). */
export function NotFoundPanel({
  thing,
  backHref,
  backLabel,
  night = false,
}: {
  thing: string;
  backHref: string;
  backLabel: string;
  night?: boolean;
}) {
  return (
    <div className={cn(night && "bg-night pt-16 md:pt-20")}>
      <section
        aria-labelledby="not-found-title"
        className={cn("mx-auto flex max-w-xl flex-col items-start gap-4 px-gutter py-16 md:py-24", night && "text-white")}
      >
        <Compass aria-hidden="true" className={cn("size-8", night ? "text-on-night-link" : "text-kick-blue")} />
        <h1 id="not-found-title" className="type-page-h1">
          We can&apos;t find that {thing}
        </h1>
        <p className={cn("text-base", night ? "text-on-night-muted" : "text-ink-3")}>
          It may have been removed from the catalogue, or the link is wrong.
        </p>
        <Button size="lg" variant={night ? "white" : "default"} render={<Link href={backHref} />}>
          {backLabel}
        </Button>
      </section>
    </div>
  );
}
