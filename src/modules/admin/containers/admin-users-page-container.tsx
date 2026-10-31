"use client"

import { useApiQuery, QueryPlaceholder } from "@/hooks/use-api-query"
import { getAdminUsers } from "@/api/admin/queries"
import { AdminUsersClient } from "@/modules/admin/components/admin-users-client"

export function AdminUsersPageContainer({
  page,
  currentUserId,
}: {
  page?: string
  currentUserId: string
}) {
  const { data: data, error } = useApiQuery(
    JSON.stringify(["admin-users", page]),
    () => getAdminUsers(page)
  )
  if (!data) return <QueryPlaceholder error={error} />
  return <AdminUsersClient currentUserId={currentUserId} users={data.users} />
}
