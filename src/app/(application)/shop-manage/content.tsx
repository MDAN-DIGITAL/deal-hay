"use client"

import { useSearchParams } from "next/navigation"

import { AuthGuard } from "@/components/session-provider"
import { singleRouteQueryValue } from "@/lib/route-query"
import { ShopManagementPageContainer } from "@/modules/shop-management/containers/shop-management-page-container"

export function ShopManagePageContent() {
  const searchParams = useSearchParams()
  return (
    <AuthGuard>
      <ShopManagementPageContainer
        initialTab={singleRouteQueryValue(searchParams, "tab")}
      />
    </AuthGuard>
  )
}
