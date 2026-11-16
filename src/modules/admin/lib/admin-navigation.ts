export const adminSections = [
  {
    href: "/admin",
    label: "Tổng quan",
    description: "Theo dõi hoạt động hệ thống và ưu tiên công việc cần xử lý.",
    icon: "overview",
  },
  {
    href: "/admin/users",
    label: "Người dùng",
    description:
      "Tra cứu tài khoản, hỗ trợ người dùng và quản lý quyền truy cập.",
    icon: "users",
  },
  {
    href: "/admin/shops",
    label: "Cửa hàng",
    description: "Kiểm tra hồ sơ, sản phẩm và hoạt động của các cửa hàng.",
    icon: "shops",
  },
  {
    href: "/admin/categories",
    label: "Danh mục",
    description: "Quản lý danh mục sản phẩm dùng chung trên toàn hệ thống.",
    icon: "categories",
  },
  {
    href: "/admin/tickets",
    label: "Yêu cầu hỗ trợ",
    description:
      "Xử lý yêu cầu nâng cấp cửa hàng, mở khóa tài khoản và khiếu nại.",
    icon: "tickets",
  },
] as const

export function adminSection(pathname: string) {
  return (
    adminSections.find(
      (section) =>
        section.href !== "/admin" && pathname.startsWith(section.href)
    ) ?? adminSections[0]
  )
}

export function adminFilterHref(
  pathname: string,
  query: string,
  values: Record<string, string>
) {
  const params = new URLSearchParams(query)
  params.delete("page")
  params.delete("shop")
  params.delete("ticket")
  for (const [key, value] of Object.entries(values)) {
    if (value.trim() && value !== "all") params.set(key, value.trim())
    else params.delete(key)
  }
  return params.size ? `${pathname}?${params}` : pathname
}

export const roleLabels: Record<string, string> = {
  administrator: "Quản trị viên",
  shop_owner: "Chủ cửa hàng",
  customer: "Khách hàng",
}

export const accountStatusOptions = [
  { value: "all", label: "Tất cả trạng thái" },
  { value: "active", label: "Đang hoạt động" },
  { value: "locked", label: "Đã khóa" },
]

export const ticketTypeOptions = [
  { value: "all", label: "Tất cả loại yêu cầu" },
  { value: "shop_owner_upgrade", label: "Nâng cấp chủ cửa hàng" },
  { value: "lock_appeal", label: "Hỗ trợ tài khoản bị khóa" },
  { value: "notification_appeal", label: "Khiếu nại thông báo" },
]

export const ticketStatusOptions = [
  { value: "all", label: "Tất cả trạng thái" },
  { value: "pending", label: "Chờ xử lý" },
  { value: "approved", label: "Đã duyệt" },
  { value: "rejected", label: "Đã từ chối" },
]

export const ticketSourceOptions = [
  { value: "all", label: "Tất cả nguồn gửi" },
  { value: "user_menu", label: "Menu người dùng" },
  { value: "locked_account_dialog", label: "Tài khoản bị khóa" },
  { value: "notification_center", label: "Trung tâm thông báo" },
]

export function adminSourceHref(value?: string | null): string | null {
  if (!value) return null
  try {
    const url = new URL(value, "https://dealhay.invalid")
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return null
    return url.origin === "https://dealhay.invalid"
      ? `${url.pathname}${url.search}${url.hash}`
      : url.href
  } catch {
    return null
  }
}
