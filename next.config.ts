import type { NextConfig } from "next"

import { publicMediaRemotePattern } from "./src/lib/public-media-url"

const publicMediaPattern = publicMediaRemotePattern(
  process.env.NEXT_PUBLIC_API_URL
)

const nextConfig: NextConfig = {
  images: {
    remotePatterns: publicMediaPattern ? [publicMediaPattern] : [],
    qualities: [75],
    formats: ["image/webp"],
    minimumCacheTTL: 31 * 24 * 60 * 60,
    maximumRedirects: 0,
    maximumResponseBody: 64 * 1024,
    dangerouslyAllowLocalIP: process.env.NODE_ENV !== "production",
  },
  async headers() {
    return [
      {
        source: "/notification-worker.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' https:",
          },
        ],
      },
    ]
  },
  experimental: {
    cpus: 1,
    globalNotFound: true,
  },
}

export default nextConfig
