import type { Metadata } from "next"
import { Suspense } from "react"

import PageLoading from "@/components/layout/page-loading"
import { NotificationsPageContent } from "./content"

export const metadata: Metadata = { title: "Thông báo" }

export default function NotificationsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <NotificationsPageContent />
    </Suspense>
  )
}
