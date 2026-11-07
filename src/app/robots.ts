import type { MetadataRoute } from "next"

import { SITE_URL } from "@/config/site"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // HTML account routes stay crawlable so their noindex metadata can be
      // observed. Robots rules are not access control and cannot deindex URLs.
      disallow: ["/api/", "/private/"],
    },
    sitemap: new URL("/sitemap.xml", SITE_URL).href,
  }
}
