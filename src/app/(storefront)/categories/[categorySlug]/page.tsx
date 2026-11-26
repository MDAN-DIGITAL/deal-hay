import type { Metadata } from "next"
import { notFound, permanentRedirect } from "next/navigation"

import {
  parsePublicCatalogQuery,
  PublicCatalogPage,
  type PublicCatalogSearchParams,
} from "@/modules/public/containers/public-catalog-page"
import {
  catalogCategorySlug,
  catalogUrl,
} from "@/modules/public/lib/catalog-url"

type CategoryPageProps = {
  params: Promise<{ categorySlug: string }>
  searchParams: Promise<PublicCatalogSearchParams>
}

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { categorySlug } = await params

  return {
    title: "Danh mục sản phẩm",
    alternates: {
      canonical: `/categories/${catalogCategorySlug(categorySlug)}`,
    },
  }
}

export default async function CategoryPage({
  params,
  searchParams,
}: CategoryPageProps) {
  const [{ categorySlug }, rawQuery] = await Promise.all([params, searchParams])
  const normalizedSlug = catalogCategorySlug(categorySlug)
  if (!normalizedSlug) notFound()

  const query = parsePublicCatalogQuery(rawQuery)
  if (categorySlug !== normalizedSlug)
    permanentRedirect(
      catalogUrl({
        category: normalizedSlug,
        search: query.search,
        filters: query.filters,
      })
    )

  return <PublicCatalogPage query={query} categorySlug={normalizedSlug} />
}
