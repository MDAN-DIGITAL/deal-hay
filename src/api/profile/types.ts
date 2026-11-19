import type { User } from "@/types/auth"
import type {
  InventoryMovement,
  ShopCategory,
  ShopCoupon,
  ShopCouponProduct,
  ShopInventoryProduct,
  ShopManagementUser,
  ShopMetrics,
  ShopOrder,
  ShopOrderSummary,
  ShopProduct,
  ShopProductReview,
} from "@/types/shop"

export type ProfileResponse = { auth: { user: User } }
export type ShopManageResponse = {
  categories?: ShopCategory[]
  products?: ShopProduct[]
  couponProducts?: ShopCouponProduct[]
  inventoryProducts?: ShopInventoryProduct[]
  coupons?: ShopCoupon[]
  orders?: ShopOrder[]
  recentOrders?: ShopOrderSummary[]
  openOrders?: number
  unansweredReviews?: number
  lowStock?: number
  metrics?: ShopMetrics
  shopMetrics?: ShopMetrics
  inventoryMovements?: InventoryMovement[]
  productReviews?: ShopProductReview[]
  auth?: { user: ShopManagementUser }
}
