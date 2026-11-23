import Link from "next/link"
import { ArrowUpRightIcon, EyeIcon, PackageCheckIcon } from "lucide-react"

import { MediaImage } from "@/components/media-image"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { formatCurrency } from "@/lib/format"
import { cn } from "@/lib/utils"
import { AddToCartButton } from "@/modules/cart/components/add-to-cart-button"
import { productPricing } from "@/modules/public/lib/product-pricing"
import type { PublicProductSummary } from "@/types/catalog"

type ProductCardProps = {
  product: PublicProductSummary
  href: string
  eyebrow?: string
  showStock?: boolean
  layout?: "default" | "grid" | "single"
  priorityImage?: boolean
  cartShopCode?: string
}

export function ProductCard({
  product,
  href,
  eyebrow,
  showStock = false,
  layout = "default",
  priorityImage = false,
  cartShopCode,
}: ProductCardProps) {
  const { salePrice, originalPrice } = productPricing(product)
  const compact = layout !== "default"
  const single = layout === "single"
  const ProductTitle = compact ? "h2" : "h3"
  const className = cn(
    "group block min-w-0 rounded-xl",
    single && "w-full max-w-sm sm:max-w-80"
  )
  const actionClassName =
    "h-auto min-h-9 min-w-0 gap-1 px-2 py-1.5 text-center text-xs whitespace-normal sm:text-sm"

  const body = (
    <>
      <div className="relative overflow-hidden">
        <MediaImage
          alt={compact ? "" : product.name}
          className={cn(
            "aspect-square w-full",
            single && "aspect-video sm:aspect-square"
          )}
          fallbackLabel="Chưa có ảnh sản phẩm"
          imageClassName={cn(
            "transition-transform duration-300 group-hover:scale-[1.02]",
            compact && "object-contain"
          )}
          sizes={
            {
              single:
                "(min-width: 640px) 320px, (min-width: 416px) 384px, calc(100vw - 2rem)",
              grid: "(min-width: 1280px) 230px, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw",
              default:
                "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw",
            }[layout]
          }
          fetchPriority={priorityImage ? "high" : undefined}
          loading={priorityImage ? "eager" : undefined}
          src={product.image_url}
        />
        <div className="absolute inset-x-2 top-2 flex flex-wrap gap-1.5">
          {product.label ? (
            <Badge className="max-w-full">
              <span className="truncate">{product.label}</span>
            </Badge>
          ) : null}
          {product.stock === 0 && !cartShopCode ? (
            <Badge variant={compact ? "secondary" : "destructive"}>
              Tạm hết hàng
            </Badge>
          ) : null}
        </div>
      </div>
      <CardContent
        className={cn(
          "min-w-0 flex-1 gap-2",
          cartShopCode ? "py-3" : "p-3",
          !compact && !cartShopCode && "sm:p-4",
          single && "sm:py-4"
        )}
      >
        {!compact && eyebrow ? (
          <p className="truncate text-xs font-medium text-primary">{eyebrow}</p>
        ) : null}
        <ProductTitle
          className={cn(
            "line-clamp-2 min-h-10 leading-5 font-medium wrap-anywhere group-hover:text-primary",
            single && "line-clamp-3 min-h-0 text-base leading-snug"
          )}
        >
          {product.name}
        </ProductTitle>
        {!compact ? (
          <p className="truncate text-xs text-muted-foreground">
            {product.category}
          </p>
        ) : null}
        <div
          className={
            compact ? "flex flex-wrap items-baseline gap-x-2" : "space-y-1 pt-1"
          }
        >
          <p
            aria-label="Giá bán"
            className={cn(
              "text-sm font-semibold wrap-anywhere text-primary sm:text-lg",
              single && "text-lg sm:text-xl"
            )}
          >
            {formatCurrency(salePrice)}
          </p>
          {originalPrice !== null ? (
            <p
              aria-label="Giá gốc"
              className="text-xs text-muted-foreground line-through"
            >
              {formatCurrency(originalPrice)}
            </p>
          ) : null}
        </div>
        {cartShopCode ? (
          <Badge
            className="h-auto max-w-full whitespace-normal"
            variant={product.stock > 0 ? "secondary" : "destructive"}
          >
            {product.stock > 0 ? `Còn ${product.stock} sản phẩm` : "Hết hàng"}
          </Badge>
        ) : null}
        {compact && eyebrow ? (
          <p className="mt-auto truncate text-xs text-muted-foreground">
            {eyebrow}
          </p>
        ) : null}
      </CardContent>
    </>
  )

  const card = (
    <Card
      size={cartShopCode ? "sm" : "default"}
      className={cn(
        "h-full gap-0 py-0",
        compact && "transition-colors group-hover:border-primary/45"
      )}
    >
      {cartShopCode ? (
        <Link href={href} tabIndex={-1} className="flex flex-1 flex-col">
          {body}
        </Link>
      ) : (
        body
      )}
      {cartShopCode ? (
        <CardFooter className="grid auto-rows-fr grid-cols-1 items-stretch gap-2 border-t pb-4">
          <Button
            size="sm"
            variant="outline"
            startIcon={<EyeIcon />}
            className={actionClassName}
            nativeButton={false}
            render={<Link href={href} />}
            aria-label={`Xem chi tiết ${product.name}`}
          >
            Xem chi tiết
          </Button>
          <AddToCartButton
            shopCode={cartShopCode}
            productSlug={product.slug}
            productId={product.id}
            disabled={product.stock <= 0}
            className={actionClassName}
          />
        </CardFooter>
      ) : !compact ? (
        <CardFooter className="justify-between gap-2 border-t px-3 py-2.5 text-xs text-muted-foreground sm:px-4">
          <span className="flex min-w-0 items-center gap-1.5">
            <PackageCheckIcon className="size-3.5 shrink-0" />
            <span className="min-w-0 leading-4 wrap-anywhere">
              {showStock
                ? `Còn ${product.stock} sản phẩm`
                : product.stock > 0
                  ? "Còn hàng"
                  : "Hết hàng"}
            </span>
          </span>
          <ArrowUpRightIcon className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </CardFooter>
      ) : null}
    </Card>
  )

  return cartShopCode ? (
    <div className={className}>{card}</div>
  ) : (
    <Link href={href} className={className}>
      {card}
    </Link>
  )
}
