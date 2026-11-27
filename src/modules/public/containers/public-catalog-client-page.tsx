"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useEffect } from "react"

import PageLoading from "@/components/layout/page-loading"
import { HomePageContainer } from "@/modules/public/containers/home-page-container"
import { catalogUrl } from "@/modules/public/lib/catalog-url"
import { readPublicCatalogQuery } from "@/modules/public/lib/public-catalog-query"

export function PublicCatalogClientPage({
  categorySlug,
  requireSearch = false,
}: {
  categorySlug?: string
  requireSearch?: boolean
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const query = readPublicCatalogQuery(searchParams)
  const redirectHref =
    requireSearch && !query.search
      ? catalogUrl({ filters: query.filters })
      : undefined

  useEffect(() => {
    if (redirectHref) router.replace(redirectHref)
  }, [redirectHref, router])

  if (redirectHref) return <PageLoading />

  return (
    <HomePageContainer
      categorySlug={categorySlug}
      search={query.search}
      filters={query.filters}
    />
  )
}
