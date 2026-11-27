import { notFound } from "next/navigation"

import { getPublicHome, PUBLIC_CATALOG_ERROR } from "@/api/catalog/server"
import { HomePageContainer } from "@/modules/public/containers/home-page-container"
import type { ParsedPublicCatalogQuery } from "@/modules/public/lib/public-catalog-query"

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
