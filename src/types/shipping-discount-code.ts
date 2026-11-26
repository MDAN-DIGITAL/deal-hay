export type ShippingDiscountCode = {
  id: string
  code: string
  expires_at: string
  used_at: string | null
  is_available: boolean
  product_id: string
  discount_percent: 100
}
