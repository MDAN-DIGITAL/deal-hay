import { wssFetch } from "@/api/wss-client"
import { notificationRoutes } from "@/api/notifications/routes"
import type { NotificationsResponse } from "@/api/notifications/types"

export function getNotifications(
  page: number,
  signal?: AbortSignal
): Promise<NotificationsResponse> {
  return wssFetch({
    path: notificationRoutes.list,
    searchParams: { page },
    signal,
  })
}

export async function getUnreadNotificationCount(): Promise<number> {
  const { notifications } = await wssFetch<{ notifications: number }>({
    path: notificationRoutes.unreadCount,
  })
  return notifications
}
