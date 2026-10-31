"use client"

import { useApiQuery, QueryPlaceholder } from "@/hooks/use-api-query"
import { redirect } from "next/navigation"

import { getShopManage } from "@/api/profile/queries"
import { ShopManagementClient } from "@/modules/shop-management/components/shop-management-client"

export function ShopManagementPageContainer({
  initialTab,
}: { initialTab?: string } = {}) {
  const { data: data, error } = useApiQuery("shop-manage", () =>
    getShopManage()
  )
  if (!data) return <QueryPlaceholder error={error} />
  const user = data.auth?.user

  if (!user) {
    redirect("/sign-in")
  }

  return (
    <ShopManagementClient
      user={user}
      categories={data.categories ?? []}
      products={data.products ?? []}
      coupons={data.coupons ?? []}
      orders={data.orders ?? []}
      metrics={data.shopMetrics ?? data.metrics}
      inventoryMovements={data.inventoryMovements ?? []}
      productReviews={data.productReviews ?? []}
      initialTab={
        initialTab &&
        [
          "overview",
          "products",
          "inventory",
          "orders",
          "promotions",
          "reviews",
          "settings",
        ].includes(initialTab)
          ? initialTab
          : "overview"
      }
    />
  )
}
