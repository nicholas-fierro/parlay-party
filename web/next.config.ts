import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build errors still surface; this hides the floating route badge that covers the mobile action bar.
  devIndicators: false,
};

export default nextConfig;
