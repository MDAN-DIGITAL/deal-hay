"use client"

import { useParams, useRouter, useSearchParams } from "next/navigation"
import { useEffect } from "react"

import PageLoading from "@/components/layout/page-loading"
import { routeQueryValue, singleRouteQueryValue } from "@/lib/route-query"
import { ProductPageContainer } from "@/modules/public/containers/product-page-container"
import {
  normalizeShopCouponCode,
  productCheckoutHref,
} from "@/modules/public/lib/product-checkout"

export function ProductPageContent() {
  const router = useRouter()
  const { shopUserCode, productSlug } = useParams<{
    shopUserCode: string
    productSlug: string
  }>()
  const searchParams = useSearchParams()
  const discountCode = singleRouteQueryValue(searchParams, "discount_code")
  const initialDiscountCode =
    discountCode && discountCode.length <= 80 ? discountCode : undefined
  const initialShopCouponCode = normalizeShopCouponCode(
    routeQueryValue(searchParams, "shop_coupon_code")
  )
  const variantId = singleRouteQueryValue(searchParams, "variant_id")
  const checkoutHref = initialDiscountCode
    ? productCheckoutHref(shopUserCode, productSlug, {
        variantId,
        discountCode: initialDiscountCode,
        shopCouponCode: initialShopCouponCode,
      })
    : undefined

  useEffect(() => {
    if (checkoutHref) router.replace(checkoutHref)
  }, [checkoutHref, router])

  if (checkoutHref) return <PageLoading />

  return (
    <ProductPageContainer
      shopUserCode={shopUserCode}
      productSlug={productSlug}
      initialShopCouponCode={initialShopCouponCode}
      initialVariantId={variantId}
    />
  )
}
