import type { Metadata } from "next"
import { Suspense } from "react"

import PageLoading from "@/components/layout/page-loading"
import { PublicShopsPageContainer } from "@/modules/public/containers/public-shops-page-container"

export const metadata: Metadata = {
  title: "Cửa hàng",
  description: "Tìm cửa hàng trên Deal Hay theo tên hoặc mã cửa hàng.",
  alternates: { canonical: "/shops" },
}

export default function PublicShopsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <PublicShopsPageContainer />
    </Suspense>
  )
}
