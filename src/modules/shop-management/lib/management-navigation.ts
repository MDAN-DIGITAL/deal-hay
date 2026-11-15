export const managementSections = [
  {
    value: "overview",
    label: "Tổng quan",
    description: "Nắm bắt hoạt động kinh doanh và ưu tiên công việc cần xử lý.",
  },
  {
    value: "orders",
    label: "Đơn hàng",
    description: "Theo dõi, tìm kiếm và xử lý đơn hàng theo từng trạng thái.",
  },
  {
    value: "products",
    label: "Sản phẩm",
    description: "Quản lý danh sách, giá bán và trạng thái hiển thị sản phẩm.",
  },
  {
    value: "inventory",
    label: "Kho hàng",
    description: "Kiểm soát tồn kho, nhập xuất hàng và lịch sử điều chỉnh.",
  },
  {
    value: "promotions",
    label: "Khuyến mãi",
    description: "Tạo và quản lý mã giảm giá để thúc đẩy doanh số cửa hàng.",
  },
  {
    value: "reviews",
    label: "Đánh giá",
    description: "Lắng nghe khách hàng và phản hồi đánh giá sản phẩm.",
  },
  {
    value: "settings",
    label: "Thiết lập cửa hàng",
    description: "Cập nhật hồ sơ, trưng bày danh mục và cấu hình vận chuyển.",
  },
] as const

export type ManagementTab = (typeof managementSections)[number]["value"]

export function managementTab(value?: string): ManagementTab {
  return (
    managementSections.find((section) => section.value === value)?.value ??
    "overview"
  )
}

export function managementHref(tab: ManagementTab) {
  return tab === "overview" ? "/shop-manage" : `/shop-manage?tab=${tab}`
}
