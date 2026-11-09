"use client"

import { useApiQuery, QueryPlaceholder } from "@/hooks/use-api-query"
import Link from "next/link"
import { ArrowLeftIcon } from "lucide-react"

import { getProduct } from "@/api/catalog/queries"
import { EmptyState } from "@/components/layout/empty-state"
import { buttonVariants } from "@/components/ui/button"
import { ProductCheckout } from "@/modules/public/components/product-checkout"
import { resolveCheckoutVariant } from "@/modules/public/lib/product-checkout"
import { productPricing } from "@/modules/public/lib/product-pricing"

export function ProductCheckoutPageContainer({
  shopUserCode,
  productSlug,
  variantId,
  initialDiscountCode,
  initialShopCouponCode,
}: {
  shopUserCode: string
  productSlug: string
  variantId?: string | string[]
  initialDiscountCode?: string
  initialShopCouponCode?: string
}) {
  const { data, error } = useApiQuery(
    JSON.stringify(["checkout", shopUserCode, productSlug, variantId]),
    () => getProduct(shopUserCode, productSlug)
  )
  if (!data) return <QueryPlaceholder error={error} />

  const { variant, invalidVariant } = resolveCheckoutVariant(
    data.product,
    variantId
  )

  if (invalidVariant) {
    return (
      <EmptyState
        title="Phân loại đã chọn không còn khả dụng"
        description="Cửa hàng đã thay đổi phân loại sản phẩm. Vui lòng chọn lại trước khi đặt hàng."
        action={
          <Link
            href={`/shops/${encodeURIComponent(shopUserCode)}/products/${encodeURIComponent(productSlug)}`}
            className={buttonVariants()}
          >
            <ArrowLeftIcon /> Chọn lại phân loại
          </Link>
        }
      />
    )
  }

  const product = data.product
  const { salePrice } = productPricing(product, variant)
  const hasVariants = product.has_variants || product.variants.length > 0
  const stock = variant?.stock ?? (hasVariants ? 0 : product.stock)

  return (
    <ProductCheckout
      key={JSON.stringify([
        product.id,
        variantId ?? null,
        initialDiscountCode ?? null,
        initialShopCouponCode ?? null,
      ])}
      shop={data.shop}
      product={product}
      variant={variant}
      salePrice={salePrice}
      stock={stock}
      initialDiscountCode={initialDiscountCode}
      initialShopCouponCode={initialShopCouponCode}
    />
  )
}
