import type { Metadata } from "next"
import { Suspense } from "react"

import PageLoading from "@/components/layout/page-loading"
import { absoluteSiteUrl, productPath } from "@/lib/seo"
import { ProductPageContent } from "./content"

type ProductPageProps = {
  params: Promise<{ shopUserCode: string; productSlug: string }>
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { shopUserCode, productSlug } = await params
  const canonical = absoluteSiteUrl(productPath(shopUserCode, productSlug))

  return {
    title: "Chi tiết sản phẩm",
    alternates: { canonical },
  }
}

export function generateStaticParams() {
  return []
}

export default function ProductPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <ProductPageContent />
    </Suspense>
  )
}
