import { notificationToastHref } from "@/modules/realtime/lib/toast-destination"
import type { AppNotification } from "@/types/notification"

export function notificationPresentation(category: string) {
  if (category.startsWith("order."))
    return { kind: "order", label: "Đơn hàng", actionLabel: "Xem đơn hàng" } as const
  if (category.startsWith("ticket."))
    return {
      kind: category === "ticket.rejected" ? "warning" : "support",
      label: "Yêu cầu hỗ trợ",
      actionLabel: "Xem yêu cầu",
    } as const
  if (category === "shop.product.deleted_by_admin")
    return {
      kind: "warning",
      label: "Sản phẩm",
      actionLabel: "Xem sản phẩm",
    } as const
  if (category.startsWith("shop."))
    return { kind: "shop", label: "Cửa hàng", actionLabel: "Xem cập nhật" } as const
  if (category.startsWith("user."))
    return { kind: "account", label: "Tài khoản", actionLabel: "Xem tài khoản" } as const
  return { kind: "general", label: "Hệ thống", actionLabel: "Xem chi tiết" } as const
}

/** Keep old notifications useful while only following local destinations. */
export function notificationActionHref(
  notification: AppNotification,
  origin: string
): string | null {
  const href = notificationToastHref(notification, origin)
  if (href === "/notifications" || href.startsWith("/notifications?"))
    return null
  const url = new URL(href, origin)
  if (url.pathname === "/shop/manage") url.pathname = "/shop-manage"
  if (/^\/admin\/tickets\/[^/]+$/.test(url.pathname))
    url.pathname = "/admin/tickets"
  return `${url.pathname}${url.search}${url.hash}`
}

export function notificationTimestamp(value: string | null, now: number) {
  const date = value ? new Date(value) : null
  if (!date || !Number.isFinite(date.getTime()))
    return {
      dateTime: undefined,
      relative: "Chưa có thời gian",
      exact: "Chưa có thời gian",
    }

  const minutes = Math.max(0, Math.floor((now - date.getTime()) / 60_000))
  const exact = new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
  const relative =
    minutes < 1
      ? "Vừa xong"
      : minutes < 60
        ? `${minutes} phút trước`
        : minutes < 24 * 60
          ? `${Math.floor(minutes / 60)} giờ trước`
          : minutes < 7 * 24 * 60
            ? `${Math.floor(minutes / (24 * 60))} ngày trước`
            : new Intl.DateTimeFormat("vi-VN", {
                timeZone: "Asia/Ho_Chi_Minh",
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              }).format(date)

  return { dateTime: date.toISOString(), relative, exact }
}
