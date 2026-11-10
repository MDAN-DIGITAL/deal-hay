"use client"

import Link from "next/link"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CirclePlayIcon,
  ShoppingBagIcon,
  TicketPercentIcon,
} from "lucide-react"
import { cn } from "cn"

import { getProduct } from "@/api/catalog/queries"
import { EmptyState } from "@/components/layout/empty-state"
import { PageHeader } from "@/components/layout/page-header"
import { MediaImage } from "@/components/media-image"
import { Badge } from "@/components/ui/badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { buttonVariants } from "@/components/ui/button"
import { Section } from "@/components/ui/section"
import { Separator } from "@/components/ui/separator"
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
    <div className="mx-auto max-w-6xl min-w-0 space-y-6 sm:space-y-8">
      <Breadcrumb aria-label="Điều hướng mua với ưu đãi">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/" />}>
              Trang chủ
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href={backHref} />}>
              Sản phẩm
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Mua với ưu đãi</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <PageHeader
        title="Mua với ưu đãi"
        description="Xem quảng cáo tùy chọn trước khi hoàn tất đơn hàng."
      />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section aria-labelledby="offer-ad-title" className="min-w-0">
          <Section
            title={<h2 id="offer-ad-title">Quảng cáo</h2>}
            icon={<CirclePlayIcon aria-hidden="true" />}
            contentClassName="gap-5"
          >
            <ProductAdvertisement
              key={`${product.id}:${variant?.id ?? "base"}`}
            />
          </Section>
        </section>

        <aside
          aria-labelledby="offer-product-title"
          className="min-w-0 lg:sticky lg:top-24"
        >
          <Section
            title={<h2 id="offer-product-title">Sản phẩm đã chọn</h2>}
            icon={<ShoppingBagIcon aria-hidden="true" />}
            contentClassName="gap-5"
          >
            <div className="flex min-w-0 items-start gap-4">
              <MediaImage
                alt={product.name}
                src={product.image_url || product.images[0]?.image_url}
                className="size-24 shrink-0 rounded-lg sm:size-28"
                imageClassName="object-contain"
                sizes="112px"
              />
              <div className="min-w-0 space-y-2">
                <h3
                  title={product.name}
                  className="line-clamp-3 text-sm leading-5 font-medium break-words"
                >
                  {product.name}
                </h3>
                <p className="truncate text-xs text-muted-foreground">
                  {shop.name}
                </p>
                {variant ? (
                  <p className="text-xs leading-5 break-words text-muted-foreground">
                    {variant.variant_label ||
                      Object.values(variant.option_values).join(" · ") ||
                      variant.sku}
                  </p>
                ) : null}
                <Badge variant="secondary">Còn hàng</Badge>
              </div>
            </div>

            <Separator />
            <dl className="space-y-1">
              <dt className="text-sm text-muted-foreground">Giá mua ngay</dt>
              <dd className="text-2xl font-semibold text-primary">
                {formatCurrency(salePrice)}
              </dd>
            </dl>
            <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
              <TicketPercentIcon
                className="mt-0.5 size-4 shrink-0 text-primary"
                aria-hidden="true"
              />
              Áp dụng mã giảm giá ở bước thanh toán.
            </p>
            <div className="grid gap-2">
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
            </div>
          </Section>
        </aside>
      </div>
    </div>
  )
}
