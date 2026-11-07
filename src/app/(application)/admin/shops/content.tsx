"use client"

import { useSearchParams } from "next/navigation"

import { AuthGuard } from "@/components/session-provider"
import { singleRouteQueryValue } from "@/lib/route-query"
import { AdminShopsPageContainer } from "@/modules/admin/containers/admin-shops-page-container"

export function AdminShopsPageContent() {
  const query = useSearchParams()
  return (
    <AuthGuard admin>
      <AdminShopsPageContainer
        search={singleRouteQueryValue(query, "search")}
        status={singleRouteQueryValue(query, "status")}
        page={singleRouteQueryValue(query, "page")}
      />
    </AuthGuard>
  )
}
