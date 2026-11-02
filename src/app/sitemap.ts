import type { MetadataRoute } from "next"

import { apiFetch } from "@/api/client"
import type { HomeResponse, ShopResponse } from "@/api/catalog/types"
import { SITE_URL } from "@/config/site"

// Fetch anonymous, current catalog data when a crawler requests the sitemap.
export const dynamic = "force-dynamic"

const MAX_CATALOG_PAGES = 50
const MAX_SHOP_REQUESTS = 32
const CATALOG_BUDGET_MS = 4_000

function pathSegment(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > 512 ||
    value === "." ||
    value === ".." ||
    /[/\\?#\u0000-\u001f\u007f]/.test(value)
  )
    return null
  try {
    return encodeURIComponent(value)
  } catch {
    return null
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const paths = new Set(["/", "/privacy", "/terms"])
  const shops = new Set<string>()
  const signal = AbortSignal.timeout(CATALOG_BUDGET_MS)
  const request = <T>(path: string, page?: number) =>
    apiFetch<T>({
      method: "GET",
      path,
      searchParams: { page },
      token: null,
      cache: "no-store",
      signal,
    })

  function addShop(code: unknown): string | null {
    const segment = pathSegment(code)
    if (!segment) return null
    paths.add(`/shops/${segment}`)
    shops.add(segment)
    return segment
  }
  function addProduct(code: unknown, slug: unknown) {
    const shop = addShop(code)
    const product = pathSegment(slug)
    if (shop && product) paths.add(`/shops/${shop}/products/${product}`)
  }
  function addHome(data: HomeResponse) {
    for (const shop of data.featuredShops ?? []) addShop(shop.code)
    for (const product of data.products?.data ?? [])
      addProduct(product.shop?.code, product.slug)
  }

  try {
    const home = await request<HomeResponse>("/")
    addHome(home)
    const totalPages = Math.min(
      MAX_CATALOG_PAGES,
      Math.max(1, Number(home.products?.last_page) || 1)
    )
    // Bound parallel work and the total time even if the catalog is very large.
    for (let page = 2; page <= totalPages && !signal.aborted; page += 4) {
      const pages = Array.from(
        { length: Math.min(4, totalPages - page + 1) },
        (_, index) => page + index
      )
      const results = await Promise.allSettled(
        pages.map((number) => request<HomeResponse>("/", number))
      )
      for (const result of results)
        if (result.status === "fulfilled") addHome(result.value)
    }
    const publicShops = [...shops].slice(0, MAX_SHOP_REQUESTS)
    for (
      let index = 0;
      index < publicShops.length && !signal.aborted;
      index += 4
    ) {
      const results = await Promise.allSettled(
        publicShops
          .slice(index, index + 4)
          .map((code) => request<ShopResponse>(`/shops/${code}`))
      )
      for (const result of results) {
        if (result.status !== "fulfilled") continue
        for (const product of result.value.products ?? [])
          addProduct(result.value.shop?.code, product.slug)
      }
    }
  } catch {
    // A catalog outage must not turn the sitemap into a 500 or invent products.
  }

  return [...paths].map((path) => ({ url: new URL(path, SITE_URL).href }))
}
