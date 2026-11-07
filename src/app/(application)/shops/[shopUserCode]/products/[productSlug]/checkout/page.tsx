import type { Metadata } from "next"
import { Suspense } from "react"

import PageLoading from "@/components/layout/page-loading"
import { ProductCheckoutPageContent } from "./content"

export const metadata: Metadata = {
  title: "Đặt hàng",
  robots: { index: false, follow: false },
}

export function generateStaticParams() {
  return []
}

export default function ProductCheckoutPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <ProductCheckoutPageContent />
    </Suspense>
  )
}
