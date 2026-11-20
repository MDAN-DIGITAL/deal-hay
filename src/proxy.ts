import { NextResponse, type NextRequest } from "next/server"

import {
  browserSupport,
  FULL_BROWSER_VERSION_HINT,
} from "@/lib/browser-support"

export function proxy(request: NextRequest) {
  const browser = browserSupport(request.headers)
  const response =
    browser.status === "allowed"
      ? NextResponse.next()
      : NextResponse.rewrite(new URL("/browser-update", request.url))
  if (browser.status !== "allowed")
    response.headers.set("Cache-Control", "private, no-store")
  if (browser.fullVersionHint)
    response.headers.set("Accept-CH", FULL_BROWSER_VERSION_HINT)
  if (browser.status === "unverified")
    response.headers.set("Critical-CH", FULL_BROWSER_VERSION_HINT)
  return response
}

export const config = {
  matcher: [
    "/((?!_next(?:/|$)|api(?:/|$)|browser-update(?:/|$)|.*\\.(?:svg|png|ico|txt|xml|js|webmanifest)$).*)",
  ],
}
