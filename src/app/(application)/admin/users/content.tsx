"use client"

import { useSearchParams } from "next/navigation"

import { AuthGuard } from "@/components/session-provider"
import { singleRouteQueryValue } from "@/lib/route-query"
import { AdminUsersPageContainer } from "@/modules/admin/containers/admin-users-page-container"

export function AuthenticatedAdminUsersPage() {
  const searchParams = useSearchParams()
  const page = singleRouteQueryValue(searchParams, "page")
  return (
    <AuthGuard admin>
      {(user) => (
        <AdminUsersPageContainer currentUserId={user.id} page={page} />
      )}
    </AuthGuard>
  )
}
