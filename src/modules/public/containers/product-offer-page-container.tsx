"use client"

import Link from "next/link"
import { ArrowLeftIcon, ArrowRightIcon, TicketPercentIcon } from "lucide-react"
import { cn } from "cn"

import { getProduct } from "@/api/catalog/queries"
import { EmptyState } from "@/components/layout/empty-state"
import { PageHeader } from "@/components/layout/page-header"
import { MediaImage } from "@/components/media-image"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Surface } from "@/components/ui/surface"
import { useApiQuery, QueryPlaceholder } from "@/hooks/use-api-query"
import { formatCurrency } from "@/lib/format"
import { ProductAdvertisement } from "@/modules/public/components/product-advertisement"
import {
  productCheckoutHref,
  productDetailHref,
  resolveCheckoutVariant,
} from "@/modules/public/lib/product-checkout"
import { productPricing } from "@/modules/public/lib/product-pricing"

export function ProductOfferPageContainer({
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
    JSON.stringify(["product-offer", shopUserCode, productSlug, variantId]),
    () => getProduct(shopUserCode, productSlug)
  )
  if (!data) return <QueryPlaceholder error={error} />

  const { product, shop } = data
  const { variant, invalidVariant } = resolveCheckoutVariant(product, variantId)
  const options = {
    variantId: variant?.id,
    discountCode: initialDiscountCode,
    shopCouponCode: initialShopCouponCode,
  }
  const backHref = productDetailHref(shopUserCode, productSlug, {
    variantId: variant?.id,
    shopCouponCode: initialShopCouponCode,
  })
  const back = (
    <Link
      href={backHref}
      className={cn(buttonVariants({ variant: "outline" }))}
    >
      <ArrowLeftIcon /> Quay lại sản phẩm
    </Link>
  )
  if (invalidVariant) {
    return (
      <EmptyState
        title="Phân loại đã chọn không còn khả dụng"
        description="Vui lòng chọn lại phân loại trước khi xem ưu đãi."
        action={back}
      />
    )
  }
  const hasVariants = product.has_variants || product.variants.length > 0
  const stock = variant?.stock ?? (hasVariants ? 0 : product.stock)
  const { salePrice } = productPricing(product, variant)
  if (stock < 1) {
    return (
      <EmptyState
        title="Sản phẩm tạm hết hàng"
        description="Bạn có thể quay lại sản phẩm để chọn lựa chọn khác."
        action={back}
      />
    )
  }
  const checkoutHref = `${productCheckoutHref(shopUserCode, productSlug, options)}#checkout-discount-title`

  return (
    <div className="mx-auto max-w-2xl min-w-0 space-y-6">
      <PageHeader
        title="Mua với ưu đãi"
        description="Xem quảng cáo tùy chọn, sau đó tiếp tục đến bước thanh toán."
      />
      <Card>
        <CardHeader>
          <CardTitle as="h2">{product.name}</CardTitle>
        </CardHeader>
        <CardContent className="gap-5">
          <div className="flex min-w-0 items-start gap-4">
            <MediaImage
              alt={product.name}
              src={product.image_url || product.images[0]?.image_url}
              className="size-20 shrink-0 rounded-lg"
              sizes="80px"
            />
            <div className="min-w-0 space-y-2">
              <p className="text-sm text-muted-foreground">{shop.name}</p>
              {variant ? (
                <p className="text-sm">
                  {variant.variant_label ||
                    Object.values(variant.option_values).join(" · ") ||
                    variant.sku}
                </p>
              ) : null}
              <p className="text-sm">
                Giá mua ngay:{" "}
                <span className="font-semibold">
                  {formatCurrency(salePrice)}
                </span>
              </p>
            </div>
          </div>
          <ProductAdvertisement
            key={`${product.id}:${variant?.id ?? "base"}`}
          />
          <Surface variant="muted" padding="sm" className="space-y-2">
            <p className="flex items-center gap-2 text-sm font-medium">
              <TicketPercentIcon
                className="size-4 shrink-0 text-primary"
                aria-hidden="true"
              />{" "}
              Ưu đãi theo mã của bạn
            </p>
            <p className="text-sm leading-6 text-muted-foreground">
              Chọn mã giảm giá hợp lệ ở bước thanh toán để xem mức giảm và tổng
              tiền thực tế. Quảng cáo không tự thay đổi giá sản phẩm.
            </p>
          </Surface>
          <Link
            href={checkoutHref}
            className={cn(
              buttonVariants({
                size: "lg",
                className: "h-auto min-h-11 w-full whitespace-normal",
              })
            )}
          >
            Tiếp tục thanh toán <ArrowRightIcon aria-hidden="true" />
          </Link>
          {back}
        </CardContent>
      </Card>
    </div>
  )
}
