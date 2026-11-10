"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
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
import { Button, buttonVariants } from "@/components/ui/button"
import { Section } from "@/components/ui/section"
import { Separator } from "@/components/ui/separator"
import { useApiQuery, QueryPlaceholder } from "@/hooks/use-api-query"
import { formatCurrency } from "@/lib/format"
import { ProductAdvertisement } from "@/modules/public/components/product-advertisement"
import { ShopOfferSelector } from "@/modules/public/components/shop-offers"
import {
  productCheckoutHref,
  productDetailHref,
  resolveCheckoutVariant,
} from "@/modules/public/lib/product-checkout"
import { productPricing } from "@/modules/public/lib/product-pricing"
import {
  createLinkedShopOfferSelection,
  overrideLinkedShopOfferSelection,
  reconcileLinkedShopOfferSelection,
  shopOfferDiscount,
} from "@/modules/public/lib/shop-offers"
import { loadShopOffersAction } from "@/modules/public/shop-offer-actions"
import type {
  PublicProduct,
  PublicProductVariant,
  PublicShop,
} from "@/types/catalog"
import type { ShopOffer } from "@/types/shop-coupon"

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
  if (stock < 1) {
    return (
      <EmptyState
        title="Sản phẩm tạm hết hàng"
        description="Bạn có thể quay lại sản phẩm để chọn lựa chọn khác."
        action={back}
      />
    )
  }
  return (
    <ProductOfferDetails
      key={JSON.stringify([
        product.id,
        variant?.id,
        initialDiscountCode,
        initialShopCouponCode,
      ])}
      product={product}
      shop={shop}
      variant={variant}
      shopUserCode={shopUserCode}
      productSlug={productSlug}
      initialDiscountCode={initialDiscountCode}
      initialShopCouponCode={initialShopCouponCode}
    />
  )
}

function ProductOfferDetails({
  product,
  shop,
  variant,
  shopUserCode,
  productSlug,
  initialDiscountCode,
  initialShopCouponCode,
}: {
  product: PublicProduct
  shop: PublicShop
  variant?: PublicProductVariant
  shopUserCode: string
  productSlug: string
  initialDiscountCode?: string
  initialShopCouponCode?: string
}) {
  const { salePrice } = productPricing(product, variant)
  const [reload, setReload] = useState(0)
  const [result, setResult] = useState<{
    revision: number
    offers: ShopOffer[]
    error: string | null
  } | null>(null)
  const [selection, setSelection] = useState(() =>
    createLinkedShopOfferSelection(initialShopCouponCode)
  )
  const [selectedCode, setSelectedCode] = useState(initialShopCouponCode)
  const [offerTime, setOfferTime] = useState(Date.now)
  const pending = result?.revision !== reload
  const offers = result?.offers ?? []
  const error = !pending ? (result?.error ?? null) : null
  const selectedOffer = offers.find(
    (offer) => offer.id === selection.selectedId
  )
  const discount =
    pending || error
      ? 0
      : shopOfferDiscount(selectedOffer, salePrice, salePrice, offerTime)
  const unconfirmedCode = Boolean(
    selectedCode && (pending || error || !selectedOffer || discount <= 0)
  )
  const options = {
    variantId: variant?.id,
    discountCode: initialDiscountCode,
    shopCouponCode: selectedCode,
  }
  const checkoutHref = `${productCheckoutHref(shopUserCode, productSlug, options)}#checkout-discount-title`
  const backHref = productDetailHref(shopUserCode, productSlug, {
    variantId: variant?.id,
    shopCouponCode: selectedCode,
  })
  const back = (
    <Link
      href={backHref}
      className={cn(buttonVariants({ variant: "outline" }))}
    >
      <ArrowLeftIcon /> Quay lại sản phẩm
    </Link>
  )

  useEffect(() => {
    let active = true
    const receive = (offers: ShopOffer[], error: string | null) => {
      if (!active) return
      setResult({ revision: reload, offers, error })
      setSelection((current) =>
        error
          ? current.userOverridden
            ? current
            : { ...current, status: "error" }
          : reconcileLinkedShopOfferSelection(
              current,
              offers,
              initialShopCouponCode
            )
      )
    }
    loadShopOffersAction(shopUserCode, product.id).then(
      (response) =>
        receive(
          response.success ? (response.data ?? []) : [],
          response.success ? null : response.message
        ),
      () => receive([], "Không tải được ưu đãi từ shop. Vui lòng thử lại.")
    )
    return () => {
      active = false
    }
  }, [shopUserCode, product.id, initialShopCouponCode, reload])

  useEffect(() => {
    const update = () => setOfferTime(Date.now())
    const refresh = () => {
      update()
      setReload((value) => value + 1)
    }
    const timer = window.setInterval(update, 30_000)
    window.addEventListener("focus", refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener("focus", refresh)
    }
  }, [])

  const selectOffer = (id: string) => {
    setSelection((current) =>
      overrideLinkedShopOfferSelection(
        current,
        id,
        Boolean(initialShopCouponCode)
      )
    )
    setSelectedCode(offers.find((offer) => offer.id === id)?.code)
  }

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
        description="Chọn mã từ cửa hàng để xem mức giảm trước khi thanh toán."
      />
      <div className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section aria-labelledby="offer-coupons-title" className="flex min-w-0">
          <Section
            title={<h2 id="offer-coupons-title">Ưu đãi từ cửa hàng</h2>}
            icon={<TicketPercentIcon aria-hidden="true" />}
            className="w-full"
            contentClassName="flex-1 gap-5"
          >
            {unconfirmedCode ? (
              <div className="space-y-2 text-sm" aria-live="polite">
                <p>
                  {pending
                    ? "Đang kiểm tra mã"
                    : "Mã đã chọn chưa được xác nhận"}{" "}
                  <strong className="break-all">{selectedCode}</strong>.
                </p>
                {!pending ? (
                  <p className="text-xs leading-5 text-muted-foreground">
                    Mã này sẽ được kiểm tra lại ở bước thanh toán. Bạn có thể
                    chọn mã khác hoặc bỏ mã.
                  </p>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => selectOffer("")}
                >
                  Không dùng mã này
                </Button>
              </div>
            ) : null}
            <ShopOfferSelector
              offers={offers}
              subtotal={salePrice}
              remaining={salePrice}
              selectedId={selection.selectedId}
              onSelect={selectOffer}
              pending={pending}
              error={error}
              onReload={() => setReload((value) => value + 1)}
              disabled={false}
            />
            <p className="text-xs leading-5 text-muted-foreground">
              Ưu đãi do cửa hàng cung cấp, không yêu cầu xem hoặc tương tác
              quảng cáo.
            </p>
          </Section>
        </section>

        <aside aria-labelledby="offer-product-title" className="flex min-w-0">
          <Section
            title={<h2 id="offer-product-title">Sản phẩm đã chọn</h2>}
            icon={<ShoppingBagIcon aria-hidden="true" />}
            className="w-full"
            contentClassName="flex-1 gap-5"
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
            <dl className="space-y-3">
              <div className="flex justify-between gap-2 text-sm">
                <dt className="text-muted-foreground">Giá bán · 1 sản phẩm</dt>
                <dd>{formatCurrency(salePrice)}</dd>
              </div>
              <div className="flex justify-between gap-2 text-sm">
                <dt className="text-muted-foreground">Ưu đãi từ shop</dt>
                <dd className="font-medium text-primary">
                  −{formatCurrency(discount)}
                </dd>
              </div>
              <div className="flex flex-wrap items-end justify-between gap-2 border-t pt-3">
                <dt className="text-sm text-muted-foreground">Tạm tính</dt>
                <dd
                  className="text-2xl font-semibold text-primary"
                  aria-live="polite"
                >
                  {formatCurrency(salePrice - discount)}
                </dd>
              </div>
            </dl>
            <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
              <TicketPercentIcon
                className="mt-0.5 size-4 shrink-0 text-primary"
                aria-hidden="true"
              />
              {initialDiscountCode
                ? "Mã giảm giá cá nhân đã được giữ lại. Tạm tính chưa gồm mã cá nhân và phí vận chuyển; tổng tiền sẽ được tính lại ở bước thanh toán."
                : "Tạm tính cho 1 sản phẩm, chưa gồm phí vận chuyển. Mã được kiểm tra lại ở bước thanh toán."}
            </p>
            <div className="mt-auto grid gap-2">
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
      <section aria-labelledby="offer-ad-title">
        <Section
          title={<h2 id="offer-ad-title">Quảng cáo</h2>}
          icon={<CirclePlayIcon aria-hidden="true" />}
        >
          <ProductAdvertisement
            key={`${product.id}:${variant?.id ?? "base"}`}
          />
        </Section>
      </section>
    </div>
  )
}
