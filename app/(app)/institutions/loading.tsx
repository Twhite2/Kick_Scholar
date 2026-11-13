import { LoadingStatus, PageHeaderSkeleton, PosterGridSkeleton } from "@/components/kick/skeletons";

export default function Loading() {
  return (
    <div className="space-y-8 pb-12">
      <LoadingStatus />
      <PageHeaderSkeleton />
      <PosterGridSkeleton count={12} />
    </div>
  );
}
