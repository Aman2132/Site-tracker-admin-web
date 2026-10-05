import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Static prototype: placeholder photos load straight from picsum in the
    // browser. With real photos on Cloudflare R2, thumbnails are generated on
    // the phone and served from the CDN, so optimisation stays off there too.
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "fastly.picsum.photos" },
    ],
  },
};

export default nextConfig;
