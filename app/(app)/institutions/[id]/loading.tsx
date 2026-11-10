import { FactTilesSkeleton, LoadingStatus, NightBannerSkeleton, RailSkeleton } from "@/components/kick/skeletons";

export default function Loading() {
  return (
    <div className="pb-12">
      <LoadingStatus />
      <NightBannerSkeleton />
      <FactTilesSkeleton />
      <RailSkeleton />
    </div>
  );
}
