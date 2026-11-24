import { NextResponse, type NextRequest } from "next/server"

import { browserSupport } from "@/lib/browser-support"

export function proxy(request: NextRequest) {
  const browser = browserSupport(request.headers)

  if (browser.status === "allowed") return NextResponse.next()

  const headers = { "Cache-Control": "private, no-store" }
  if (request.method === "GET" || request.method === "HEAD") {
    return NextResponse.rewrite(new URL("/browser-update", request.url), {
      headers,
    })
  }

  return new NextResponse(null, { status: 403, headers })
}

export const config = {
  matcher: [
    // Exclude exact public asset paths so a file-like product slug is still checked.
    "/((?!_next/(?:static|image|webpack-hmr)(?:/|$)|(?:browser-update|ads\\.txt|robots\\.txt|sitemap\\.xml|manifest\\.webmanifest|favicon\\.ico|apple-icon\\.png|icon\\.svg|notification-(?:worker\\.js|badge\\.png|icon-(?:192|512)\\.png)|dealhay-(?:logo\\.svg|home-banner\\.webp|social\\.png))$).*)",
  ],
}
