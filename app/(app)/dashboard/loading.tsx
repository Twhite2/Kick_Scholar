import { LoadingStatus, NightBannerSkeleton, RailSkeleton } from "@/components/kick/skeletons";

export default function Loading() {
  return (
    <div className="space-y-12 pb-12">
      <LoadingStatus label="Loading your matches" />
      <NightBannerSkeleton tall />
      <RailSkeleton />
      <RailSkeleton card="ticket" />
      <RailSkeleton card="funding" />
    </div>
  );
}
