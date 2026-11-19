"use client"

import { useApiQuery, QueryPlaceholder } from "@/hooks/use-api-query"
import { redirect } from "next/navigation"

import { getShopManage } from "@/api/profile/queries"
import { ShopManagementClient } from "@/modules/shop-management/components/shop-management-client"
import { managementTab } from "@/modules/shop-management/lib/management-navigation"

export function ShopManagementPageContainer({
  initialTab,
}: { initialTab?: string } = {}) {
  const tab = managementTab(initialTab)
  const { data: shell, error } = useApiQuery("shop-manage-shell", () =>
    getShopManage("shell")
  )
  const { data, error: sectionError } = useApiQuery(`shop-manage-${tab}`, () =>
    tab === "settings" ? Promise.resolve(undefined) : getShopManage(tab)
  )
  if (!shell) return <QueryPlaceholder error={error} />
  const user = shell.auth?.user

  if (!user) {
    redirect("/sign-in")
  }

  return (
    <ShopManagementClient
      user={user}
      categories={shell.categories ?? []}
      openOrderCount={shell.openOrders}
      unansweredReviewCount={
        shell.unansweredReviews ??
        shell.productReviews?.filter((review) => !review.shop_reply).length
      }
      products={data?.products ?? []}
      inventoryProducts={data?.inventoryProducts ?? data?.products ?? []}
      coupons={data?.coupons ?? []}
      couponProducts={data?.couponProducts ?? data?.products ?? []}
      orders={data?.orders ?? []}
      recentOrders={data?.recentOrders}
      lowStockCount={data?.lowStock}
      metrics={data?.shopMetrics ?? data?.metrics}
      inventoryMovements={data?.inventoryMovements ?? []}
      productReviews={data?.productReviews ?? []}
      sectionPlaceholder={
        tab !== "settings" && !data ? (
          <QueryPlaceholder error={sectionError} />
        ) : undefined
      }
      initialTab={tab}
    />
  )
}
