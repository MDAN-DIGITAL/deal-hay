import type { NextConfig } from "next"

import { notificationMenuHref } from "./src/modules/notifications/lib/notification-menu-navigation"
import { publicMediaRemotePattern } from "./src/lib/public-media-url"

const publicMediaPattern = publicMediaRemotePattern(
  process.env.NEXT_PUBLIC_API_URL
)
const development = process.env.NODE_ENV !== "production"
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  `script-src 'self' 'unsafe-inline'${development ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https:${development ? " http:" : ""}`,
  "font-src 'self' data:",
  `connect-src 'self' https: wss:${development ? " http: ws:" : ""}`,
  `media-src 'self' blob: https:${development ? " http:" : ""}`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  ...(development ? [] : ["upgrade-insecure-requests"]),
].join("; ")
const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
  },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  ...(development
    ? []
    : [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]),
]

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: false,
  images: {
    remotePatterns: publicMediaPattern ? [publicMediaPattern] : [],
    qualities: [75],
    formats: ["image/webp"],
    minimumCacheTTL: 31 * 24 * 60 * 60,
    maximumRedirects: 0,
    maximumResponseBody: 64 * 1024,
    dangerouslyAllowLocalIP: process.env.NODE_ENV !== "production",
  },
  async redirects() {
    return [
      {
        source: "/notifications",
        destination: notificationMenuHref,
        permanent: false,
      },
    ]
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
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
    globalNotFound: true,
  },
}

export default nextConfig
