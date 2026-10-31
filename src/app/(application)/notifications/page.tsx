import type { Metadata } from "next"

import { AuthGuard } from "@/components/session-provider"
import { NotificationsPageContainer } from "@/modules/notifications/containers/notifications-page-container"

export const metadata: Metadata = { title: "Thông báo" }

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { page } = await searchParams
  return (
    <AuthGuard>
      <NotificationsPageContainer page={page} />
    </AuthGuard>
  )
}
