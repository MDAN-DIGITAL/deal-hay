import type {
  ProductOption,
  ProductVariant,
  ProductReview,
} from "@/types/catalog"
import type { User } from "@/types/auth"

export type ShopManagementUser = Pick<
  User,
  | "user_code"
  | "full_name"
  | "avatar_url"
  | "shop_avatar_url"
  | "shop_name"
  | "shop_email"
  | "shop_phone_number"
  | "shop_province"
  | "shop_ward"
  | "shop_address_detail"
>

export type ShopProductImage = {
  id: string
  image_url: string
  display_order: number
}

export type ShopProductVariant = ProductVariant & {
  id: string
  sku: string
  variant_label?: string | null
  retired_at?: string | null
}

export type ShopProduct = {
  id: string
  slug?: string
  sku: string | null
  name: string
  category: string
  description: string | null
  price: number
  old_price?: number | null
  video_url?: string | null
  stock: number
  has_variants: boolean
  shared_stock?: boolean
  label: string | null
  image_url: string | null
  is_active: boolean
  images: ShopProductImage[]
  options: ProductOption[]
  variants: ShopProductVariant[]
  retired_variants: ShopProductVariant[]
}

export type ShopCoupon = {
  id: string
  code: string
  product_ids: string[]
  name: string
  discount_type: "fixed" | "percent"
  discount_value: number
  minimum_order_amount: number
  maximum_discount_amount: number | null
  usage_limit: number | null
  used_count: number
  starts_at: string | null
  ends_at: string | null
  is_active: boolean
}

export type ShopCouponProduct = Pick<
  ShopProduct,
  "id" | "sku" | "name" | "price" | "is_active"
>

export type ShopInventoryProduct = Pick<
  ShopProduct,
  | "id"
  | "name"
  | "sku"
  | "stock"
  | "category"
  | "image_url"
  | "is_active"
  | "has_variants"
  | "shared_stock"
> & {
  variants: Pick<
    ShopProductVariant,
    | "id"
    | "sku"
    | "stock"
    | "is_active"
    | "is_default"
    | "option_values"
    | "variant_label"
    | "retired_at"
  >[]
}

export type ShopOrderItem = {
  id: string
  product_name: string
  variant_name: string | null
  quantity: number
  unit_price: number
  subtotal: number
}

export type ShopOrder = {
  id: string
  order_number: string
  customer_name: string
  customer_phone: string
  shipping_address: string
  status:
    | "pending"
    | "confirmed"
    | "processing"
    | "shipping"
    | "completed"
    | "cancelled"
  subtotal: number
  discount_amount: number
  shipping_fee?: number
  shipping_discount_amount?: number
  shipping_total?: number
  total: number
  note: string | null
  created_at: string | null
  items: ShopOrderItem[]
}

export type InventoryMovement = {
  id: string
  product_name: string
  variant_name: string | null
  type: string
  quantity_delta: number
  stock_after: number
  note: string | null
  created_at: string | null
}

export type ShopOrderSummary = Pick<
  ShopOrder,
  "id" | "order_number" | "customer_name" | "status" | "total" | "created_at"
>

export type ShopCategory = {
  id: string
  name: string
  display_order: number
  is_active: boolean
}

export type ShopMetrics = {
  products_count: number
  total_products_count: number
  hidden_products_count: number
  followers_count: number
  likes_count: number
  dislikes_count: number
  reactions_count: number
  satisfaction_rate: number | null
  response_rate: number | null
  customer_conversations_count: number
  responded_conversations_count: number
  total_orders_count: number
  completed_orders_count: number
  open_orders_count: number
  total_revenue: number
  total_stock: number
  active_coupons_count: number
}

export type ShopProductReview = ProductReview & {
  product: NonNullable<ProductReview["product"]>
}
