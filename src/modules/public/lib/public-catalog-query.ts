import type { HomeCatalogRequest } from "@/api/catalog/types"
import { routeQueryValue } from "@/lib/route-query"
import {
  catalogFlag,
  catalogPrice,
  catalogSearch,
  catalogSort,
} from "@/modules/public/lib/catalog-query"

export type PublicCatalogSearchParams = {
  category?: string | string[]
  q?: string | string[]
  sort?: string | string[]
  min_price?: string | string[]
  max_price?: string | string[]
  in_stock?: string | string[]
  on_sale?: string | string[]
  liked?: string | string[]
}

export type ParsedPublicCatalogQuery = {
  search?: string
  filters: Required<
    Pick<HomeCatalogRequest, "sort" | "inStock" | "onSale" | "liked">
  > &
    Pick<HomeCatalogRequest, "minPrice" | "maxPrice">
}

export function parsePublicCatalogQuery(
  query: PublicCatalogSearchParams
): ParsedPublicCatalogQuery {
  const search = catalogSearch(query.q)
  const sort = catalogSort(query.sort)
  const minPrice = catalogPrice(query.min_price)
  const parsedMaxPrice = catalogPrice(query.max_price)
  const maxPrice =
    minPrice !== undefined &&
    parsedMaxPrice !== undefined &&
    parsedMaxPrice < minPrice
      ? undefined
      : parsedMaxPrice

  return {
    search,
    filters: {
      sort,
      minPrice,
      maxPrice,
      inStock: catalogFlag(query.in_stock),
      onSale: catalogFlag(query.on_sale),
      liked: catalogFlag(query.liked),
    },
  }
}

export function readPublicCatalogQuery(searchParams: {
  getAll: (name: string) => string[]
}): ParsedPublicCatalogQuery {
  return parsePublicCatalogQuery({
    q: routeQueryValue(searchParams, "q"),
    sort: routeQueryValue(searchParams, "sort"),
    min_price: routeQueryValue(searchParams, "min_price"),
    max_price: routeQueryValue(searchParams, "max_price"),
    in_stock: routeQueryValue(searchParams, "in_stock"),
    on_sale: routeQueryValue(searchParams, "on_sale"),
    liked: routeQueryValue(searchParams, "liked"),
  })
}
