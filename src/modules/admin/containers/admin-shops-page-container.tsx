"use client"

import { useApiQuery, QueryPlaceholder } from "@/hooks/use-api-query"
import { getAdminShops } from "@/api/admin/queries"
import { AdminShopsClient } from "@/modules/admin/components/admin-shops-client"

export function AdminShopsPageContainer({
  search,
  status,
  page,
}: {
  search?: string
  status?: string
  page?: string
}) {
  const { data: data, error } = useApiQuery(
    JSON.stringify(["admin-shops", search, status, page]),
    () => getAdminShops(search, status, page)
  )
  if (!data) return <QueryPlaceholder error={error} />
  return <AdminShopsClient shops={data.shops} />
}
