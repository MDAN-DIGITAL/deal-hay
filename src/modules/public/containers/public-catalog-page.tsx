import { notFound } from "next/navigation"

import { getPublicHome, PUBLIC_CATALOG_ERROR } from "@/api/catalog/server"
import type { HomeCatalogRequest } from "@/api/catalog/types"
import { HomePageContainer } from "@/modules/public/containers/home-page-container"
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

export async function PublicCatalogPage({
  query,
  categorySlug,
}: {
  query: ParsedPublicCatalogQuery
  categorySlug?: string
}) {
  const result = await getPublicHome({
    categorySlug,
    page: "1",
    q: query.search,
    ...query.filters,
  })

  if (
    categorySlug &&
    result.status === "ready" &&
    result.data.filters.category === ""
  )
    notFound()

  return (
    <HomePageContainer
      categorySlug={categorySlug}
      search={query.search}
      filters={query.filters}
      initialData={result.status === "ready" ? result.data : undefined}
      initialError={
        result.status === "ready" ? undefined : PUBLIC_CATALOG_ERROR
      }
    />
  )
}
