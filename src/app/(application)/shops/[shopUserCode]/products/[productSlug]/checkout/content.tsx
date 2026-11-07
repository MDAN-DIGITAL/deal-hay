"use client"

import { useParams, useSearchParams } from "next/navigation"

import { routeQueryValue, singleRouteQueryValue } from "@/lib/route-query"
import { ProductCheckoutPageContainer } from "@/modules/public/containers/product-checkout-page-container"
import { normalizeShopCouponCode } from "@/modules/public/lib/product-checkout"

export function ProductCheckoutPageContent() {
  const { shopUserCode, productSlug } = useParams<{
    shopUserCode: string
    productSlug: string
  }>()
  const query = useSearchParams()
  const discountCode = singleRouteQueryValue(query, "discount_code")

  return (
    <ProductCheckoutPageContainer
      shopUserCode={shopUserCode}
      productSlug={productSlug}
      variantId={routeQueryValue(query, "variant_id")}
      initialDiscountCode={
        discountCode && discountCode.length <= 80 ? discountCode : undefined
      }
      initialShopCouponCode={normalizeShopCouponCode(
        routeQueryValue(query, "shop_coupon_code")
      )}
    />
  )
}
