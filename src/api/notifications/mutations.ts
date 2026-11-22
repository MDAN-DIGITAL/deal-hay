import { apiFetch } from "@/api/client"
import { notificationRoutes } from "@/api/notifications/routes"
import type { ApiMessageResponse } from "@/types/common"

export function markAllNotificationsRead(): Promise<ApiMessageResponse> {
  return apiFetch({ method: "PATCH", path: notificationRoutes.readAll })
}

export function markVisibleNotificationsRead(
  notificationIds: string[]
): Promise<ApiMessageResponse> {
  return apiFetch({
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
