import type { Metadata } from "next"

import { AuthGuard } from "@/components/session-provider"
import { ShopManagementPageContainer } from "@/modules/shop-management/containers/shop-management-page-container"

export const metadata: Metadata = { title: "Quản lý shop" }

export default async function ShopManagePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  return (
    <AuthGuard>
      <ShopManagementPageContainer initialTab={tab} />
    </AuthGuard>
  )
}
