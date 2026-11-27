import type { Metadata } from "next"
import { Suspense } from "react"

import PageLoading from "@/components/layout/page-loading"
import { PublicCatalogClientPage } from "@/modules/public/containers/public-catalog-client-page"

export const metadata: Metadata = {
  title: "Tìm kiếm sản phẩm",
  alternates: { canonical: "/search" },
  robots: { index: false, follow: true },
}

export default function SearchPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <PublicCatalogClientPage requireSearch />
    </Suspense>
  )
}
