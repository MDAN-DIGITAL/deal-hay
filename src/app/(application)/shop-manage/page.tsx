import type { Metadata } from "next"
import { Suspense } from "react"

import PageLoading from "@/components/layout/page-loading"
import { ShopManagePageContent } from "./content"

export const metadata: Metadata = { title: "Quản lý shop" }

export default function ShopManagePage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <ShopManagePageContent />
    </Suspense>
  )
}
