import type { Metadata } from "next"
import { Suspense } from "react"

import PageLoading from "@/components/layout/page-loading"
import { ProfilePageContent } from "./content"

export const metadata: Metadata = { title: "Hồ sơ của tôi" }

export default function ProfilePage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <ProfilePageContent />
    </Suspense>
  )
}
