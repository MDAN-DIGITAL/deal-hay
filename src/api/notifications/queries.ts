import { apiFetch } from "@/api/client"
import { notificationRoutes } from "@/api/notifications/routes"
import type { NotificationsResponse } from "@/api/notifications/types"

export function getNotifications(
  page: number,
  signal?: AbortSignal
): Promise<NotificationsResponse> {
  return apiFetch({
    path: notificationRoutes.list,
    searchParams: { page },
    signal,
  })
}
