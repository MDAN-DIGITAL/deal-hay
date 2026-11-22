export function notificationPresentation(category: string) {
  if (category.startsWith("order."))
    return {
      kind: "order",
      label: "Đơn hàng",
      actionLabel: "Xem đơn hàng",
    } as const
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
    return {
      kind: "shop",
      label: "Cửa hàng",
      actionLabel: "Xem cập nhật",
    } as const
  if (category.startsWith("user."))
    return {
      kind: "account",
      label: "Tài khoản",
      actionLabel: "Xem tài khoản",
    } as const
  return {
    kind: "general",
    label: "Hệ thống",
    actionLabel: "Xem chi tiết",
  } as const
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
