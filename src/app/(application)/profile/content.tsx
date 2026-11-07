"use client"

import { useSearchParams } from "next/navigation"

import { AuthGuard } from "@/components/session-provider"
import { singleRouteQueryValue } from "@/lib/route-query"
import { ProfilePageContainer } from "@/modules/profile/containers/profile-page-container"

export function ProfilePageContent() {
  const searchParams = useSearchParams()
  return (
    <AuthGuard>
      <ProfilePageContainer tab={singleRouteQueryValue(searchParams, "tab")} />
    </AuthGuard>
  )
}
