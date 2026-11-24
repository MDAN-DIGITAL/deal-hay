import type { Metadata } from "next"
import { Suspense } from "react"

import PageLoading from "@/components/layout/page-loading"
import { ProductInterestsPageContent } from "./content"

export const metadata: Metadata = { title: "Danh mục quan tâm" }

export default function ProductInterestsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <ProductInterestsPageContent />
    </Suspense>
  )
}
