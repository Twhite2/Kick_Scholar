import type { NextConfig } from "next";

// Where institution logos and covers are stored (docs/ui-remodel.md §11).
// Site-relative paths (/media/...) need no entry; a remote bucket does.
const mediaBase = process.env.NEXT_PUBLIC_MEDIA_BASE_URL;
const mediaPattern = (() => {
  if (!mediaBase) return [];
  try {
    const u = new URL(mediaBase);
    return [{ protocol: u.protocol.replace(":", "") as "http" | "https", hostname: u.hostname, pathname: `${u.pathname.replace(/\/$/, "")}/**` }];
  } catch {
    return [];
  }
})();

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: mediaPattern,
  },
  async redirects() {
    // Saved and Applications merged into My plan; old links keep working.
    return [
      { source: "/saved", destination: "/plan?tab=saved", permanent: false },
      { source: "/applications", destination: "/plan?tab=applications", permanent: false },
    ];
  },
};

export default nextConfig;
