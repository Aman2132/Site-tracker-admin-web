import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Photos load straight from Supabase Storage in the browser. The phone makes
    // the thumbnails, so there is nothing for Next to resize.
    unoptimized: true,
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],
  },
};

export default nextConfig;
