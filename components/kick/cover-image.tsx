import Image, { getImageProps } from "next/image";
import { preload } from "react-dom";
import { cn } from "@/lib/utils";
import { countryTint, sceneFor, sceneUrl, type SceneName } from "@/lib/ui/country";
import { getDataSaver } from "@/lib/ui/data-saver";
import type { CoverPhoto } from "@/lib/types/cards";

export interface CoverImageProps {
  institutionId: string;
  countryCode?: string | null;
  city?: string | null;
  photo?: CoverPhoto | null;
  /** next/image sizes hint (§12.2). */
  sizes: string;
  /**
   * Only the billboard and detail banners. "desktop" preloads the photo for
   * wide screens only: the desktop billboard is hidden on phones, and a
   * plain priority image would be downloaded there anyway.
   */
  priority?: boolean | "desktop";
  /** Force a scene instead of a photo (destination tiles). */
  scene?: SceneName;
  /** Override the request's data saver setting (dev kit only). */
  dataSaver?: boolean;
  /** "Show photo" on detail banners: one page ignores data saver. */
  forcePhoto?: boolean;
  className?: string;
}

/**
 * Poster art (docs/ui-remodel.md §6.3): the cached campus photo, else an
 * illustrated scene for the country, else — with data saver on — a flat
 * country tint with the city name. Always decorative: the title is next to it.
 */
export async function CoverImage({
  institutionId,
  countryCode,
  city,
  photo,
  sizes,
  priority = false,
  scene,
  dataSaver,
  forcePhoto = false,
  className,
}: CoverImageProps) {
  const saver = forcePhoto ? false : (dataSaver ?? (await getDataSaver()));

  if (saver) {
    return (
      <div
        aria-hidden="true"
        className={cn("absolute inset-0 overflow-hidden", className)}
        style={{ backgroundColor: countryTint(countryCode) }}
      >
        {city && (
          <span className="absolute right-3 bottom-2 font-display text-[15px] font-bold text-white/[.88]">
            {city}
          </span>
        )}
      </div>
    );
  }

  if (photo && !scene && priority === "desktop") {
    const { props } = getImageProps({ src: photo.url, alt: "", fill: true, sizes });
    preload(props.src, {
      as: "image",
      imageSrcSet: props.srcSet,
      imageSizes: props.sizes,
      fetchPriority: "high",
      media: "(min-width: 768px)",
    });
    return (
      <div
        aria-hidden="true"
        className={cn("absolute inset-0 overflow-hidden", className)}
        style={{ backgroundColor: photo.color ?? countryTint(countryCode) }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- props come from getImageProps */}
        <img {...props} loading="lazy" fetchPriority="high" className="ks-cover-photo object-cover object-center" />
      </div>
    );
  }

  if (photo && !scene) {
    return (
      <div
        aria-hidden="true"
        className={cn("absolute inset-0 overflow-hidden", className)}
        style={{ backgroundColor: photo.color ?? countryTint(countryCode) }}
      >
        <Image
          src={photo.url}
          alt=""
          fill
          sizes={sizes}
          priority={priority === true}
          loading={priority === true ? undefined : "lazy"}
          className="ks-cover-photo object-cover object-center"
        />
      </div>
    );
  }

  const name = scene ?? sceneFor(countryCode, institutionId);
  return (
    <div
      aria-hidden="true"
      className={cn("absolute inset-0 overflow-hidden", className)}
      style={{ backgroundColor: countryTint(countryCode) }}
    >
      <Image
        src={sceneUrl(name)}
        alt=""
        fill
        sizes={sizes}
        priority={priority === true}
        loading={priority === true ? undefined : "lazy"}
        unoptimized
        className="object-cover object-bottom"
      />
    </div>
  );
}
