import type { Metadata } from "next"
import { permanentRedirect } from "next/navigation"

import {
  parsePublicCatalogQuery,
  PublicCatalogPage,
  type PublicCatalogSearchParams,
} from "@/modules/public/containers/public-catalog-page"
import { catalogUrl } from "@/modules/public/lib/catalog-url"

export const metadata: Metadata = {
  title: "Tìm kiếm sản phẩm",
  alternates: { canonical: "/search" },
  robots: { index: false, follow: true },
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<PublicCatalogSearchParams>
}) {
  const query = parsePublicCatalogQuery(await searchParams)

  if (!query.search) permanentRedirect(catalogUrl({ filters: query.filters }))

  return <PublicCatalogPage query={query} />
}
