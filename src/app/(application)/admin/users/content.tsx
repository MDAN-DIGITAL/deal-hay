"use client"

import { AuthGuard } from "@/components/session-provider"
import { AdminUsersPageContainer } from "@/modules/admin/containers/admin-users-page-container"

export function AuthenticatedAdminUsersPage({ page }: { page?: string }) {
  return (
    <AuthGuard admin>
      {(user) => (
        <AdminUsersPageContainer currentUserId={user.id} page={page} />
      )}
    </AuthGuard>
  )
}
