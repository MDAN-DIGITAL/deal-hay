"use client"

import { useApiQuery, QueryPlaceholder } from "@/hooks/use-api-query"
import { useSession } from "@/components/session-provider"
import { getNotifications } from "@/api/notifications/queries"
import { NotificationsPageClient } from "@/modules/notifications/components/notifications-page-client"

export function NotificationsPageContainer({ page }: { page?: string }) {
  const session = useSession()
  const { data, error } = useApiQuery(
    JSON.stringify(["notifications", page]),
    () => getNotifications(page)
  )
  if (!data) return <QueryPlaceholder error={error} />
  return (
    <NotificationsPageClient
      key={data.notification_page.current_page ?? 1}
      currentUserId={session.user?.id}
      page={data.notification_page}
    />
  )
}
