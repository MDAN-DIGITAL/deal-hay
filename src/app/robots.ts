import type { MetadataRoute } from "next"

import { SITE_URL } from "@/config/site"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/api/",
        "/private/",
        "/chats",
        "/notifications",
        "/discount-codes",
        "/diagnostics",
        "/profile",
        "/shop-manage",
        "/sell",
        "/sign-in",
        "/sign-up",
        "/forgot-password",
        "/reset-password",
        "/forbidden",
        "/shops/*/products/*/checkout",
      ],
    },
    sitemap: new URL("/sitemap.xml", SITE_URL).href,
  }
}
