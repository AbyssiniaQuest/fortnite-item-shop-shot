import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.GITHUB_PAGES === "true" ? "export" : undefined,
  trailingSlash: process.env.GITHUB_PAGES === "true",
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "fortnite-api.com"
      },
      {
        protocol: "https",
        hostname: "media.fortniteapi.io"
      },
      {
        protocol: "https",
        hostname: "images.fortnite-api.com"
      },
      {
        protocol: "https",
        hostname: "cdn.fortnite-api.com"
      }
    ]
  }
};

export default nextConfig;
