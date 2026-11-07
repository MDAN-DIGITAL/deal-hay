import type { Metadata } from "next"

import { ProductCheckoutPageContainer } from "@/modules/public/containers/product-checkout-page-container"
import { normalizeShopCouponCode } from "@/modules/public/lib/product-checkout"

export const metadata: Metadata = {
  title: "Đặt hàng",
  robots: { index: false, follow: false },
}

export default async function ProductCheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ shopUserCode: string; productSlug: string }>
  searchParams: Promise<{
    variant_id?: string | string[]
    discount_code?: string | string[]
    shop_coupon_code?: string | string[]
  }>
}) {
  const [{ shopUserCode, productSlug }, query] = await Promise.all([
    params,
    searchParams,
  ])

  return (
    <ProductCheckoutPageContainer
      shopUserCode={shopUserCode}
      productSlug={productSlug}
      variantId={query.variant_id}
      initialDiscountCode={
        typeof query.discount_code === "string" &&
        query.discount_code.length <= 80
          ? query.discount_code
          : undefined
      }
      initialShopCouponCode={normalizeShopCouponCode(query.shop_coupon_code)}
    />
  )
}
