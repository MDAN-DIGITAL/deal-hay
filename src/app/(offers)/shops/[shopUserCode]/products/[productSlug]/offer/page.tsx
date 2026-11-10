import type { Metadata } from "next"
import { Suspense } from "react"

import PageLoading from "@/components/layout/page-loading"
import { ProductOfferPageContent } from "./content"

export const metadata: Metadata = { title: "Mua với ưu đãi" }

export function generateStaticParams() {
  return []
}

export default function ProductOfferPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <ProductOfferPageContent />
    </Suspense>
  )
}
