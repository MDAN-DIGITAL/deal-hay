import "server-only"

import { cache } from "react"
import { ApiError, apiFetch, type ApiRequestOptions } from "@/api/client"
import { catalogRoutes } from "@/api/catalog/routes"
import type {
  HomeResponse,
  ProductResponse,
  ShopResponse,
} from "@/api/catalog/types"

export type PublicCatalogResult<T> =
  | { status: "ready"; data: T }
  | { status: "not-found" }
  | { status: "unavailable" }

export const PUBLIC_CATALOG_TIMEOUT_MS = 5000
export const PUBLIC_CATALOG_ERROR = "Không thể tải nội dung. Vui lòng thử lại."

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function hasShop(value: unknown): boolean {
  return (
    object(value) &&
    typeof value.code === "string" &&
    typeof value.name === "string" &&
    typeof value.address === "string" &&
    object(value.viewer)
  )
}

function isHome(value: unknown): value is HomeResponse {
  return (
    object(value) &&
    Array.isArray(value.featuredShops) &&
    object(value.products) &&
    Array.isArray(value.products.data) &&
    typeof value.products.total === "number" &&
    Array.isArray(value.categories) &&
    object(value.filters) &&
    typeof value.filters.category === "string"
  )
}

function isShop(value: unknown): value is ShopResponse {
  return (
    object(value) &&
    hasShop(value.shop) &&
    Array.isArray(value.products) &&
    Array.isArray(value.categories)
  )
}

function isProduct(value: unknown): value is ProductResponse {
  return (
    object(value) &&
    hasShop(value.shop) &&
    object(value.product) &&
    typeof value.product.name === "string" &&
    (value.product.description === null ||
      typeof value.product.description === "string") &&
    Array.isArray(value.product.images) &&
    Array.isArray(value.product.options) &&
    Array.isArray(value.product.variants) &&
    Array.isArray(value.relatedProducts) &&
    Array.isArray(value.reviews) &&
    object(value.reviewSummary)
  )
}

async function readPublicCatalog<T>(
  request: Pick<ApiRequestOptions, "path" | "searchParams">,
  valid: (value: unknown) => value is T
): Promise<PublicCatalogResult<T>> {
  try {
    const data = await apiFetch<unknown>({
      ...request,
      // Public snapshots must never depend on a browser account or cached identity.
      token: null,
      cache: "no-store",
      signal: AbortSignal.timeout(PUBLIC_CATALOG_TIMEOUT_MS),
    })
    return valid(data) ? { status: "ready", data } : { status: "unavailable" }
  } catch (error) {
    return error instanceof ApiError && error.status === 404
      ? { status: "not-found" }
      : { status: "unavailable" }
  }
}

// React cache deduplicates metadata/page reads only within the current request.
export const getPublicHome = cache((category?: string) =>
  readPublicCatalog(
    { path: catalogRoutes.home, searchParams: { category } },
    isHome
  )
)

export const getPublicShop = cache(
  (shopUserCode: string, category?: string, page?: string) =>
    readPublicCatalog(
      {
        path: catalogRoutes.shop(encodeURIComponent(shopUserCode)),
        searchParams: { category, page },
      },
      isShop
    )
)

export const getPublicProduct = cache(
  (shopUserCode: string, productSlug: string) =>
    readPublicCatalog(
      {
        path: catalogRoutes.product(
          encodeURIComponent(shopUserCode),
          encodeURIComponent(productSlug)
        ),
      },
      isProduct
    )
)
