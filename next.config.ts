import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  reactStrictMode: false, // Temporarily disabled to avoid double-render issues
  // Fjern experimental og andre options som gir warning
};

export default nextConfig;