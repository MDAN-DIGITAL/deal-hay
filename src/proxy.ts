import { NextResponse, type NextRequest } from "next/server"

import { browserSupport } from "@/lib/browser-support"
import {
  catalogFlag,
  catalogPrice,
  catalogSearch,
  catalogSort,
} from "@/modules/public/lib/catalog-query"
import {
  catalogCategorySlug,
  catalogUrl,
} from "@/modules/public/lib/catalog-url"

function legacyCatalogRedirect(request: NextRequest): NextResponse | undefined {
  const { pathname, searchParams } = request.nextUrl
  const search = catalogSearch(searchParams.get("q") ?? undefined)
  const minPrice = catalogPrice(searchParams.get("min_price") ?? undefined)
  const parsedMaxPrice = catalogPrice(
    searchParams.get("max_price") ?? undefined
  )
  const filters = {
    sort: catalogSort(searchParams.get("sort") ?? undefined),
    minPrice,
    maxPrice:
      minPrice !== undefined &&
      parsedMaxPrice !== undefined &&
      parsedMaxPrice < minPrice
        ? undefined
        : parsedMaxPrice,
    inStock: catalogFlag(searchParams.get("in_stock") ?? undefined),
    onSale: catalogFlag(searchParams.get("on_sale") ?? undefined),
    liked: catalogFlag(searchParams.get("liked") ?? undefined),
  }
  let category = ""

  if (pathname === "/") {
    category = (searchParams.get("category") ?? "").trim().slice(0, 120)
    if (!category && !search) return
  } else if (pathname === "/search") {
    if (search) return
  } else if (pathname.startsWith("/categories/")) {
    const categorySegment = pathname.slice("/categories/".length)
    if (categorySegment.includes("/")) return
    try {
      category = decodeURIComponent(categorySegment)
    } catch {
      return
    }
    const normalizedSlug = catalogCategorySlug(category)
    if (!normalizedSlug || pathname === `/categories/${normalizedSlug}`) return
    category = normalizedSlug
  } else {
    return
  }

  return NextResponse.redirect(
    new URL(catalogUrl({ category, search, filters }), request.url),
    308
  )
}

export function proxy(request: NextRequest) {
  const browser = browserSupport(request.headers)

  if (browser.status === "allowed")
    return legacyCatalogRedirect(request) ?? NextResponse.next()

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
