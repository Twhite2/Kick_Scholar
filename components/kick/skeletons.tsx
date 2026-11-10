import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Loading shapes that mirror the final layouts (docs/ui-remodel.md §7.5), so
 * nothing jumps when content arrives. No shimmer under reduced motion.
 */

export function NightBannerSkeleton({ tall = false }: { tall?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={cn("bg-night px-gutter pt-24 pb-11 md:pt-28", tall ? "min-h-[560px] md:min-h-[700px]" : "min-h-[440px]")}
    >
      <div className="flex max-w-[720px] flex-col gap-5">
        <div className="flex items-center gap-3">
          <div className="size-14 animate-pulse rounded-[15px] bg-white/10" />
          <div className="h-4 w-48 animate-pulse rounded-full bg-white/10" />
        </div>
        <div className="h-12 w-full max-w-[560px] animate-pulse rounded-xl bg-white/10" />
        <div className="h-12 w-2/3 animate-pulse rounded-xl bg-white/10" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded-full bg-white/10" />
        <div className="h-4 w-72 max-w-full animate-pulse rounded-full bg-white/10" />
      </div>
    </div>
  );
}

export function RailSkeleton({ card = "poster" }: { card?: "poster" | "ticket" | "funding" }) {
  const size =
    card === "ticket" ? "h-[124px] w-[300px] md:h-[132px] md:w-[340px]" : card === "funding" ? "h-[316px] w-[220px] md:h-[340px] md:w-[272px]" : "h-[300px] w-[236px] md:h-[384px] md:w-[272px]";
  return (
    <div aria-hidden="true" className="space-y-4">
      <div className="px-gutter">
        <Skeleton className="h-7 w-64 rounded-full" />
      </div>
      <div className="flex gap-5 overflow-hidden px-gutter pb-7">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className={cn("flex-none rounded-poster", size)} />
        ))}
      </div>
    </div>
  );
}

export function PageHeaderSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-3 px-gutter pt-8 md:pt-12">
      <Skeleton className="h-10 w-56 rounded-xl" />
      <Skeleton className="h-4 w-72 rounded-full" />
    </div>
  );
}

export function PosterGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div
      aria-hidden="true"
      className="mx-auto grid max-w-[1328px] gap-5 px-gutter [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]"
    >
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="aspect-[272/384] rounded-poster" />
      ))}
    </div>
  );
}

export function FactTilesSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="grid gap-3 px-gutter py-6 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]"
    >
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-[92px] rounded-tile" />
      ))}
    </div>
  );
}

/** Screen-reader status while a route streams in. */
export function LoadingStatus({ label = "Loading" }: { label?: string }) {
  return (
    <p role="status" className="sr-only">
      {label}…
    </p>
  );
}
