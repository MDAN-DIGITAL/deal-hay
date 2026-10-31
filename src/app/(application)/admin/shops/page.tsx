import type { Metadata } from "next"

import { AuthGuard } from "@/components/session-provider"
import { AdminShopsPageContainer } from "@/modules/admin/containers/admin-shops-page-container"

export const metadata: Metadata = { title: "Admin shop" }

export default async function AdminShopsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; status?: string; page?: string }>
}) {
  const { search, status, page } = await searchParams
  return (
    <AuthGuard admin>
      <AdminShopsPageContainer search={search} status={status} page={page} />
    </AuthGuard>
  )
}
