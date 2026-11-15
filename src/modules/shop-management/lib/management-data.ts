import type { ShopOrder, ShopProduct } from "@/types/shop"

export const orderStatusLabels: Record<ShopOrder["status"], string> = {
  pending: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  processing: "Đang chuẩn bị",
  shipping: "Đang giao",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
}

export type ProductFilter = "all" | "active" | "hidden" | "low-stock"
export type OrderFilter = "all" | "open" | ShopOrder["status"]

function searchable(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .trim()
}

export function isOpenOrder(order: ShopOrder) {
  return order.status !== "completed" && order.status !== "cancelled"
}

export function isLowStock(product: ShopProduct) {
  return product.is_active && product.stock <= 5
}

export function filterShopProducts(
  products: ShopProduct[],
  query: string,
  status: ProductFilter
) {
  const search = searchable(query)
  return products.filter((product) => {
    const matchesStatus =
      status === "all" ||
      (status === "active" && product.is_active) ||
      (status === "hidden" && !product.is_active) ||
      (status === "low-stock" && isLowStock(product))
    return (
      matchesStatus &&
      searchable(
        `${product.name} ${product.sku ?? ""} ${product.category}`
      ).includes(search)
    )
  })
}

export function filterShopOrders(
  orders: ShopOrder[],
  query: string,
  status: OrderFilter
) {
  const search = searchable(query)
  return orders.filter((order) => {
    const matchesStatus =
      status === "all" ||
      (status === "open" ? isOpenOrder(order) : order.status === status)
    return (
      matchesStatus &&
      searchable(
        `${order.order_number} ${order.customer_name} ${order.customer_phone} ${order.items.map((item) => item.product_name).join(" ")}`
      ).includes(search)
    )
  })
}
