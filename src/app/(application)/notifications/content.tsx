"use client"

import { useSearchParams } from "next/navigation"

import { AuthGuard } from "@/components/session-provider"
import { singleRouteQueryValue } from "@/lib/route-query"
import { NotificationsPageContainer } from "@/modules/notifications/containers/notifications-page-container"

export function NotificationsPageContent() {
  const searchParams = useSearchParams()
  return (
    <AuthGuard>
      <NotificationsPageContainer
        page={singleRouteQueryValue(searchParams, "page")}
      />
    </AuthGuard>
  )
}
