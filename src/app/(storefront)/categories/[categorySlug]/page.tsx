import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import PageLoading from "@/components/layout/page-loading"
import { PublicCatalogClientPage } from "@/modules/public/containers/public-catalog-client-page"
import { catalogCategorySlug } from "@/modules/public/lib/catalog-url"

type CategoryPageProps = {
  params: Promise<{ categorySlug: string }>
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

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { categorySlug } = await params
  const normalizedSlug = catalogCategorySlug(categorySlug)
  if (!normalizedSlug) notFound()

  return (
    <Suspense fallback={<PageLoading />}>
      <PublicCatalogClientPage categorySlug={normalizedSlug} />
    </Suspense>
  )
}
