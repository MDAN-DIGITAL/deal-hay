import type { Metadata } from "next"
import { Suspense } from "react"

import PageLoading from "@/components/layout/page-loading"
import { AdminShopsPageContent } from "./content"

export const metadata: Metadata = { title: "Admin shop" }

export default function AdminShopsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <AdminShopsPageContent />
    </Suspense>
  )
}
