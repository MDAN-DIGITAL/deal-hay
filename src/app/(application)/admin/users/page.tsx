import type { Metadata } from "next"
import { Suspense } from "react"

import PageLoading from "@/components/layout/page-loading"
import { AuthenticatedAdminUsersPage } from "./content"

export const metadata: Metadata = { title: "Admin người dùng" }

export default function AdminUsersPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <AuthenticatedAdminUsersPage />
    </Suspense>
  )
}
