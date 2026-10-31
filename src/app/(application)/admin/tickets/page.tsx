import type { Metadata } from "next"

import { AuthGuard } from "@/components/session-provider"
import { AdminTicketsPageContainer } from "@/modules/admin/containers/admin-tickets-page-container"

export const metadata: Metadata = { title: "Admin ticket" }

export default async function AdminTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string
    status?: string
    source?: string
    page?: string
  }>
}) {
  const { type, status, source, page } = await searchParams
  return (
    <AuthGuard admin>
      <AdminTicketsPageContainer
        type={type}
        status={status}
        source={source}
        page={page}
      />
    </AuthGuard>
  )
}
