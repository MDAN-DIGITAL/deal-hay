import type { Metadata } from "next"
import { Suspense } from "react"

import PageLoading from "@/components/layout/page-loading"
import { AdminTicketsPageContent } from "./content"

export const metadata: Metadata = { title: "Admin ticket" }

export default function AdminTicketsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <AdminTicketsPageContent />
    </Suspense>
  )
}
