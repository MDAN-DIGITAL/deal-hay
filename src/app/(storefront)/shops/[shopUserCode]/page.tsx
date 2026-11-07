import type { Metadata } from "next"
import { Suspense } from "react"

import PageLoading from "@/components/layout/page-loading"
import { ShopPageContent } from "./content"

// Shop data intentionally loads in the browser. Product pages remain SSR for SEO.
export const metadata: Metadata = { title: "Gian hàng" }

export function generateStaticParams() {
  return []
}

export default function ShopPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <ShopPageContent />
    </Suspense>
  )
}
