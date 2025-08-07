import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Viktige tillegg for å fikse problemene:
  reactStrictMode: true,
  swcMinify: true,
  compiler: {
    removeConsole: false, // Behold console.logs for debugging
  },
  // Fikser CSS/MIME-type og response-problemer:
  webpack: (config) => {
    config.resolve.fallback = { fs: false, path: false };
    return config;
  },
  // Øker body size limit for store responser:
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  // Headers for bedre CORS-håndtering:
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
    ];
  },
};

export default nextConfig;