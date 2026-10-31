"use client"

import { AuthGuard } from "@/components/session-provider"
import { SellPageContainer } from "@/modules/selling/containers/sell-page-container"

export function AuthenticatedSellPage() {
  return <AuthGuard>{(user) => <SellPageContainer user={user} />}</AuthGuard>
}
