"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";

/** The only client part of a logo tile: swap to the monogram if the image fails. */
export function LogoImage({
  src,
  size,
  padding,
  fallback,
}: {
  src: string;
  size: number;
  padding: number;
  fallback: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{fallback}</>;
  const inner = size - padding * 2;
  return (
    <Image
      src={src}
      alt=""
      width={inner}
      height={inner}
      sizes={`${inner}px`}
      loading="lazy"
      className="object-contain"
      style={{ width: inner, height: inner }}
      onError={() => setFailed(true)}
    />
  );
}
