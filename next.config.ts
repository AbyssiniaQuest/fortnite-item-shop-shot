import type { NextConfig } from "next";

const githubPagesBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const isGitHubPages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  output: isGitHubPages ? "export" : undefined,
  trailingSlash: isGitHubPages,
  basePath: isGitHubPages ? githubPagesBasePath : undefined,
  assetPrefix: isGitHubPages ? githubPagesBasePath : undefined,
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
