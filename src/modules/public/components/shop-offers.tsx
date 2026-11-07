"use client"

import { useEffect, useId, useState } from "react"
import Link from "next/link"
import {
  ArrowRightIcon,
  ChevronDownIcon,
  TicketPercentIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Surface } from "@/components/ui/surface"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { formatCurrency, formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import { productDetailHref } from "@/modules/public/lib/product-checkout"
import { loadShopOffersAction } from "@/modules/public/shop-offer-actions"
import { shopOfferDiscount } from "@/modules/public/lib/shop-offers"
import type { ShopOffer } from "@/types/shop-coupon"

function offerValue(offer: ShopOffer): string {
  return offer.discount_type === "percent"
    ? `${offer.discount_value}%`
    : formatCurrency(offer.discount_value)
}

export function shopOfferProductHref(
  shopCode: string,
  productSlug: string,
  offerCode: string
): string {
  return productDetailHref(shopCode, productSlug, {
    shopCouponCode: offerCode,
  })
}

function ShopOfferCard({
  offer,
  shopCode,
}: {
  offer: ShopOffer
  shopCode: string
}) {
  const productListId = useId()
  const [expanded, setExpanded] = useState(false)
  const hasMoreProducts = offer.products.length > 3
  const visibleProducts = expanded ? offer.products : offer.products.slice(0, 3)

  return (
    <Surface
      render={<article />}
      className="flex h-full min-w-0 flex-col gap-4"
    >
      <div className="min-w-0">
        <p className="text-xl font-semibold text-primary">
          Giảm {offerValue(offer)}
        </p>
        <h3 className="mt-1 font-medium break-words">{offer.name}</h3>
      </div>

      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <Surface variant="muted" padding="sm">
          <span className="block text-xs text-muted-foreground">
            Đơn tối thiểu
          </span>
          <strong className="mt-1 block font-medium">
            {formatCurrency(offer.minimum_order_amount)}
          </strong>
        </Surface>
        <Surface variant="muted" padding="sm">
          <span className="block text-xs text-muted-foreground">Thời hạn</span>
          <strong className="mt-1 block font-medium">
            {offer.ends_at ? formatDate(offer.ends_at) : "Không giới hạn"}
          </strong>
        </Surface>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span>Mã ưu đãi</span>
        <code className="max-w-full rounded-md bg-muted px-2 py-1 font-medium break-all text-foreground">
          {offer.code}
        </code>
        {offer.maximum_discount_amount !== null ? (
          <span>· Tối đa {formatCurrency(offer.maximum_discount_amount)}</span>
        ) : null}
        {offer.remaining_uses !== null ? (
          <span>· Còn {offer.remaining_uses} lượt</span>
        ) : null}
      </div>

      <div className="mt-auto space-y-2 border-t pt-4">
        <div>
          <p className="text-sm font-medium">Chọn sản phẩm áp dụng</p>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
            Mã sẽ được gắn sẵn và tự áp dụng khi bạn đặt hàng.
          </p>
        </div>
        <ul id={productListId} className="space-y-2">
          {visibleProducts.map((product) => (
            <li key={product.id} className="min-w-0">
              <Link
                className="group flex w-full min-w-0 items-center gap-3 rounded-xl border border-border bg-background p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                href={shopOfferProductHref(shopCode, product.slug, offer.code)}
              >
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 block text-sm leading-5 font-medium break-words group-hover:text-primary">
                    {product.name}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Xem sản phẩm · Tự áp dụng khi đặt hàng
                  </span>
                </span>
                <ArrowRightIcon
                  aria-hidden="true"
                  className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                />
              </Link>
            </li>
          ))}
        </ul>
        {hasMoreProducts ? (
          <Button
            type="button"
            className="w-full"
            variant="ghost"
            size="sm"
            aria-controls={productListId}
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
          >
            <ChevronDownIcon
              aria-hidden="true"
              className={cn("transition-transform", expanded && "rotate-180")}
            />
            {expanded
              ? "Thu gọn danh sách"
              : `Xem thêm ${offer.products.length - 3} sản phẩm`}
          </Button>
        ) : null}
      </div>
    </Surface>
  )
}

export function ShopOffers({ shopCode }: { shopCode: string }) {
  const [result, setResult] = useState<{
    offers: ShopOffer[]
    error?: string
  } | null>(null)
  const [reload, setReload] = useState(0)
  useEffect(() => {
    let active = true
    loadShopOffersAction(shopCode)
      .then((response) => {
        if (active)
          setResult({
            offers: response.data ?? [],
            error: response.success ? undefined : response.message,
          })
      })
      .catch(() => {
        if (active)
          setResult({ offers: [], error: "Không tải được ưu đãi từ shop." })
      })
    return () => {
      active = false
    }
  }, [shopCode, reload])

  return (
    <section className="space-y-4" aria-labelledby="shop-offers-heading">
      <div className="flex items-center gap-3">
        <span className="rounded-xl bg-primary/10 p-2 text-primary">
          <TicketPercentIcon aria-hidden="true" className="size-5" />
        </span>
        <div>
          <h2 id="shop-offers-heading" className="text-2xl font-semibold">
            Ưu đãi từ shop
          </h2>
          <p className="text-sm text-muted-foreground">
            Chọn sản phẩm phù hợp, ưu đãi sẽ được gắn sẵn khi đặt hàng.
          </p>
        </div>
      </div>
      {!result ? (
        <p className="text-sm text-muted-foreground" role="status">
          Đang tải ưu đãi...
        </p>
      ) : result.error ? (
        <div className="flex items-center gap-3 text-sm">
          <p role="alert">{result.error}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setReload((value) => value + 1)}
          >
            Thử lại
          </Button>
        </div>
      ) : result.offers.length === 0 ? (
        <Surface
          variant="dashed"
          render={<p />}
          className="text-muted-foreground"
        >
          Shop chưa có ưu đãi đang áp dụng.
        </Surface>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {result.offers.map((offer) => (
            <ShopOfferCard key={offer.id} offer={offer} shopCode={shopCode} />
          ))}
        </div>
      )}
    </section>
  )
}

export function ShopOfferSelector({
  offers,
  subtotal,
  remaining,
  selectedId,
  onSelect,
  pending,
  error,
  onReload,
  disabled,
}: {
  offers: ShopOffer[]
  subtotal: number
  remaining: number
  selectedId: string
  onSelect: (id: string) => void
  pending: boolean
  error: string | null
  onReload: () => void
  disabled: boolean
}) {
  const prefix = useId()

  return (
    <Surface
      render={<fieldset disabled={disabled} />}
      variant="inset"
      className="space-y-3"
    >
      <legend id={`${prefix}-legend`} className="px-1 font-medium">
        Ưu đãi từ shop
      </legend>
      <p className="text-xs leading-5 text-muted-foreground">
        Chọn một ưu đãi cho sản phẩm này. Mức giảm được tính trên tiền hàng còn
        lại sau các mã khác.
      </p>
      {pending ? (
        <p className="text-sm text-muted-foreground" role="status">
          Đang tải ưu đãi từ shop...
        </p>
      ) : null}
      {error ? (
        <div className="space-y-2">
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onReload}
            disabled={disabled}
          >
            Tải lại ưu đãi
          </Button>
        </div>
      ) : null}
      <RadioGroup
        aria-labelledby={`${prefix}-legend`}
        name="shop_offer"
        value={selectedId}
        onValueChange={(value) => onSelect(value)}
        disabled={disabled}
      >
        <Surface
          render={<Label htmlFor={`${prefix}-none`} />}
          padding="sm"
          className="flex cursor-pointer items-center gap-3 font-normal"
        >
          <RadioGroupItem id={`${prefix}-none`} value="" />
          Không dùng ưu đãi từ shop
        </Surface>
        {offers.map((offer) => {
          const discount = shopOfferDiscount(offer, subtotal, remaining)
          return (
            <Surface
              key={offer.id}
              render={<Label htmlFor={`${prefix}-${offer.id}`} />}
              padding="sm"
              variant={discount > 0 ? "default" : "muted"}
              className={`flex items-start gap-3 ${discount > 0 ? "cursor-pointer" : "text-muted-foreground"}`}
            >
              <RadioGroupItem
                id={`${prefix}-${offer.id}`}
                className="mt-1"
                value={offer.id}
                disabled={pending || discount <= 0}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">
                  {offer.name} · Giảm {offerValue(offer)}
                </span>
                <span className="mt-1 block text-xs">
                  Tiền hàng từ {formatCurrency(offer.minimum_order_amount)}
                  {offer.maximum_discount_amount !== null
                    ? ` · Tối đa ${formatCurrency(offer.maximum_discount_amount)}`
                    : ""}
                </span>
                {offer.ends_at ? (
                  <span className="mt-1 block text-xs">
                    Hạn {formatDate(offer.ends_at)}
                  </span>
                ) : null}
                <span
                  className={`mt-1 block text-xs ${discount > 0 ? "text-primary" : ""}`}
                >
                  {discount > 0
                    ? `Tiết kiệm thêm ${formatCurrency(discount)}`
                    : subtotal < offer.minimum_order_amount
                      ? `Cần thêm ${formatCurrency(offer.minimum_order_amount - subtotal)} tiền hàng`
                      : "Chưa đủ điều kiện hoặc mã đã hết hiệu lực"}
                </span>
              </span>
            </Surface>
          )
        })}
      </RadioGroup>
      {!pending && !error && !offers.length ? (
        <p className="text-sm text-muted-foreground">
          Sản phẩm này chưa có ưu đãi từ shop.
        </p>
      ) : null}
    </Surface>
  )
}
