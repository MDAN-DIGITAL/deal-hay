import type { Metadata } from "next"

import { AuthGuard } from "@/components/session-provider"
import { AdminCategoriesPageContainer } from "@/modules/admin/containers/admin-categories-page-container"

export const metadata: Metadata = { title: "Admin danh mục" }

export default function AdminCategoriesPage() {
  return (
    <AuthGuard admin>
      <AdminCategoriesPageContainer />
    </AuthGuard>
  )
}
