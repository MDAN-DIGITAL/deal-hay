import { apiFetch } from "@/api/client"
import { wssFetch } from "@/api/wss-client"
import { notificationRoutes } from "@/api/notifications/routes"
import type { ApiMessageResponse } from "@/types/common"

type NotificationReadResponse = ApiMessageResponse & { read_at: string }

export function markAllNotificationsRead(): Promise<NotificationReadResponse> {
  return wssFetch({ method: "PATCH", path: notificationRoutes.readAll })
}

export function markVisibleNotificationsRead(
  notificationIds: string[]
): Promise<NotificationReadResponse> {
  return wssFetch({
    method: "PATCH",
    path: notificationRoutes.readVisible,
    body: { notification_ids: notificationIds },
  })
}

export function createTicket(
  payload: Record<string, unknown>
): Promise<ApiMessageResponse<Record<string, unknown>>> {
  return apiFetch({
    method: "POST",
    path: notificationRoutes.tickets,
    body: payload,
  })
}
