import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Server-rendered previous/next links that keep the current filters. */
export function Pager({
  pathname,
  params,
  page,
  totalPages,
}: {
  pathname: string;
  params: Record<string, string | string[] | undefined>;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;

  const href = (target: number) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (key !== "page" && typeof value === "string") next.set(key, value);
    }
    if (target > 1) next.set("page", String(target));
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  const linkClass =
    "inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted";
  const disabledClass = "pointer-events-none opacity-40";

  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-4">
      <Link href={href(page - 1)} aria-disabled={page <= 1} className={cn(linkClass, page <= 1 && disabledClass)}>
        <ChevronLeft className="size-4" /> Previous
      </Link>
      <span className="text-sm text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      <Link
        href={href(page + 1)}
        aria-disabled={page >= totalPages}
        className={cn(linkClass, page >= totalPages && disabledClass)}
      >
        Next <ChevronRight className="size-4" />
      </Link>
    </nav>
  );
}
