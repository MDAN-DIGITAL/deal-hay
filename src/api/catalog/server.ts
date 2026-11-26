import "server-only"

import { cache } from "react"
import {
  API_UNAVAILABLE_MESSAGE,
  ApiError,
  apiFetch,
  type ApiRequestOptions,
} from "@/api/client"
import { catalogRoutes } from "@/api/catalog/routes"
import type {
  HomeResponse,
  HomeCatalogRequest,
  ProductResponse,
  PublicShopsResponse,
  ShopResponse,
} from "@/api/catalog/types"

export type PublicCatalogResult<T> =
  | { status: "ready"; data: T }
  | { status: "not-found" }
  | { status: "unavailable" }

export const PUBLIC_CATALOG_TIMEOUT_MS = 5000
export const PUBLIC_CATALOG_REVALIDATE_SECONDS = 30
export const PUBLIC_CATALOG_ERROR = API_UNAVAILABLE_MESSAGE

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

function isShop(value: unknown): value is ShopResponse {
  return (
    object(value) &&
    hasShop(value.shop) &&
    Array.isArray(value.products) &&
    Array.isArray(value.categories)
  )
}

function isPublicShops(value: unknown): value is PublicShopsResponse {
  return (
    object(value) &&
    object(value.shops) &&
    Array.isArray(value.shops.data) &&
    typeof value.shops.total === "number" &&
    object(value.filters) &&
    typeof value.filters.q === "string"
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
      credentials: "omit",
      // A short shared cache avoids paying for the same anonymous catalog read on
      // every navigation while the browser still revalidates viewer-specific data.
      cache: "force-cache",
      next: { revalidate: PUBLIC_CATALOG_REVALIDATE_SECONDS },
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
export const getPublicHome = cache(
  ({
    category,
    categorySlug,
    page,
    q,
    sort,
    minPrice,
    maxPrice,
    inStock,
    onSale,
    liked,
  }: HomeCatalogRequest = {}) =>
    readPublicCatalog(
      {
        path: catalogRoutes.home,
        searchParams: {
          category,
          category_slug: categorySlug,
          page,
          q,
          sort: sort === "recommended" ? undefined : sort,
          min_price: minPrice,
          max_price: maxPrice,
          in_stock: inStock ? 1 : undefined,
          on_sale: onSale ? 1 : undefined,
          liked: liked ? 1 : undefined,
          catalog_schema: 5,
        },
      },
      isHome
    )
)

export const getPublicShops = cache((q?: string, page?: string) =>
  readPublicCatalog(
    {
      path: catalogRoutes.shops,
      searchParams: { q, page, catalog_schema: 3 },
    },
    isPublicShops
  )
)

export const getPublicShop = cache((shopUserCode: string) =>
  readPublicCatalog(
    {
      path: catalogRoutes.shop(encodeURIComponent(shopUserCode)),
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
