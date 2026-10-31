"use client"

import { useApiQuery, QueryPlaceholder } from "@/hooks/use-api-query"
import { redirect } from "next/navigation"

import { getProfile } from "@/api/profile/queries"
import { ProfilePageClient } from "@/modules/profile/components/profile-page-client"

export function ProfilePageContainer({ tab }: { tab?: string }) {
  const { data: response, error } = useApiQuery("profile", () => getProfile())
  if (!response) return <QueryPlaceholder error={error} />
  if (!response.auth.user) {
    redirect("/sign-in")
  }
  if (tab === "seller") {
    if (response.auth.user.role === "shop_owner") {
      redirect("/shop-manage")
    }
    if (response.auth.user.role === "administrator") {
      redirect("/admin/shops")
    }
  }
  return <ProfilePageClient tab={tab} user={response.auth.user} />
}
