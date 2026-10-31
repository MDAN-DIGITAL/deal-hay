"use client"

import { useApiQuery, QueryPlaceholder } from "@/hooks/use-api-query"
import { getAdminTickets } from "@/api/admin/queries"
import { AdminTicketsClient } from "@/modules/admin/components/admin-tickets-client"

export function AdminTicketsPageContainer({
  type,
  status,
  source,
  page,
}: {
  type?: string
  status?: string
  source?: string
  page?: string
}) {
  const { data: data, error } = useApiQuery(
    JSON.stringify(["admin-tickets", type, status, source, page]),
    () => getAdminTickets(type, status, source, page)
  )
  if (!data) return <QueryPlaceholder error={error} />
  return <AdminTicketsClient tickets={data.tickets} />
}
