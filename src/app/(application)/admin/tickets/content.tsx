"use client"

import { useSearchParams } from "next/navigation"

import { AuthGuard } from "@/components/session-provider"
import { singleRouteQueryValue } from "@/lib/route-query"
import { AdminTicketsPageContainer } from "@/modules/admin/containers/admin-tickets-page-container"

export function AdminTicketsPageContent() {
  const query = useSearchParams()
  return (
    <AuthGuard admin>
      <AdminTicketsPageContainer
        type={singleRouteQueryValue(query, "type")}
        status={singleRouteQueryValue(query, "status")}
        source={singleRouteQueryValue(query, "source")}
        page={singleRouteQueryValue(query, "page")}
      />
    </AuthGuard>
  )
}
