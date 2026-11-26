"use client"

import {
  ArrowRightIcon,
  MinusIcon,
  PlusIcon,
  ShoppingBagIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react"
import Link from "next/link"
import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"

import { ApiError } from "@/api/client"
import { getCheckoutProduct } from "@/api/catalog/queries"
import type { CheckoutProductResponse } from "@/api/catalog/types"
import { EmptyState } from "@/components/layout/empty-state"
import { MediaImage } from "@/components/media-image"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group"
import { Card, CardContent, CardFooter, CardTitle } from "@/components/ui/card"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { PageHeading } from "@/components/ui/page-heading"
import { Section } from "@/components/ui/section"
import { useApiQuery } from "@/hooks/use-api-query"
import { formatCurrency } from "@/lib/format"
import {
  productCheckoutHref,
  productDetailHref,
} from "@/modules/public/lib/product-checkout"
import { productPricing } from "@/modules/public/lib/product-pricing"
import {
  cartAvailability,
  cartLineKey,
  productVariantLabel,
  type CartLine,
} from "../lib/cart"
import { addCartItem, removeCartItem, useCart } from "../lib/cart-store"

type ProductRef = Pick<CartLine, "productId" | "productSlug" | "shopCode">
type Inventory = CheckoutProductResponse | "unavailable" | "error"

async function checkInventory({
  productId,
  productSlug,
  shopCode,
}: ProductRef): Promise<Inventory> {
  try {
    const snapshot = await getCheckoutProduct(shopCode, productSlug)
    return snapshot.product.id === productId ? snapshot : "unavailable"
  } catch (error) {
    return error instanceof ApiError &&
      (error.status === 404 || error.status === 410)
      ? "unavailable"
      : "error"
  }
}

async function loadCartInventory(products: ProductRef[]) {
  const result = new Map<string, Inventory>()
  for (let start = 0; start < products.length; start += 6) {
    await Promise.all(
      products.slice(start, start + 6).map(async (product) => {
        result.set(product.productId, await checkInventory(product))
      })
    )
  }
  return result
}

function CartRow({
  line,
  lines,
  inventory,
  onInventoryChange,
}: {
  line: CartLine
  lines: readonly CartLine[]
  inventory: Inventory | undefined
  onInventoryChange: (productId: string, inventory: Inventory) => void
}) {
  const [pending, startTransition] = useTransition()
  const snapshot = typeof inventory === "object" ? inventory : undefined
  const available =
    snapshot && cartAvailability(snapshot.product, line.variantId, lines)
  const canOrder = !!available && line.quantity <= available.maxQuantity
  const livePrice =
    snapshot && available
      ? productPricing(snapshot.product, available.variant).salePrice
      : undefined
  const variantLabel = available?.variant
    ? productVariantLabel(available.variant)
    : line.variantLabel
  const label = variantLabel
    ? `${line.productName}, ${variantLabel}`
    : line.productName
  const options = { variantId: line.variantId ?? undefined }
  const href = productDetailHref(line.shopCode, line.productSlug, options)

  const change = (operation: () => Promise<void>) =>
    startTransition(async () => {
      try {
        await operation()
      } catch (error) {
        toast.error(
          error instanceof TypeError
            ? "Chưa kiểm tra được tồn kho. Vui lòng thử lại."
            : error instanceof Error
              ? error.message
              : "Không thể cập nhật giỏ hàng."
        )
      }
    })

  return (
    <Card role="listitem" size="sm">
      <CardContent>
        <Item className="flex-nowrap items-start p-0">
          <ItemMedia>
            <Link href={href} className="rounded-lg">
              <MediaImage
                src={snapshot?.product.image_url}
                alt={line.productName}
                className="size-16 rounded-lg sm:size-20"
                imageClassName="object-contain"
                sizes="80px"
              />
            </Link>
          </ItemMedia>
          <ItemContent className="min-w-0">
            <CardTitle as="h2" className="wrap-anywhere">
              <Link href={href} className="hover:text-primary">
                {snapshot?.product.name ?? line.productName}
              </Link>
            </CardTitle>
            <ItemDescription className="wrap-anywhere">
              {snapshot?.shop.name ?? line.shopName}
              {variantLabel ? ` · ${variantLabel}` : ""}
            </ItemDescription>
            {livePrice !== undefined ? (
              <ItemTitle className="text-primary">
                {formatCurrency(livePrice)} / sản phẩm
              </ItemTitle>
            ) : null}
            <Badge
              variant={
                available && available.stock > 0 ? "secondary" : "outline"
              }
            >
              {available
                ? available.stock > 0
                  ? `Kho còn ${available.stock} sản phẩm`
                  : "Hết hàng"
                : inventory === "error"
                  ? "Chưa kiểm tra được tồn kho"
                  : inventory
                    ? "Không còn bán"
                    : "Đang kiểm tra tồn kho"}
            </Badge>
            {available && canOrder ? (
              <ItemDescription aria-live="polite">
                Có thể thêm {available.remaining} sản phẩm
              </ItemDescription>
            ) : null}
          </ItemContent>
        </Item>
        {available && available.stock > 0 && !canOrder ? (
          <Alert variant="warning" role="status">
            <TriangleAlertIcon aria-hidden="true" />
            <AlertDescription>
              {available.maxQuantity > 0
                ? `Có thể mua tối đa ${available.maxQuantity} sản phẩm với phân loại này. Vui lòng giảm số lượng.`
                : "Số lượng trong giỏ đã vượt tồn. Vui lòng giảm số lượng ở phân loại khác của sản phẩm này."}
            </AlertDescription>
          </Alert>
        ) : null}
      </CardContent>

      <CardFooter className="flex-wrap justify-between gap-2 border-t">
        <ItemActions>
          <ButtonGroup aria-label={`Điều chỉnh số lượng ${label}`}>
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              aria-label={`Giảm số lượng ${label}`}
              tooltip="Giảm số lượng"
              disabled={pending || line.quantity <= 1}
              onClick={() => change(() => removeCartItem(line, 1))}
            >
              <MinusIcon aria-hidden="true" />
            </Button>
            <ButtonGroupText
              render={<output />}
              aria-label={`Số lượng ${label}`}
            >
              {line.quantity}
            </ButtonGroupText>
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              aria-label={`Tăng số lượng ${label}`}
              tooltip="Tăng số lượng"
              disabled={pending || !available?.remaining}
              onClick={() =>
                change(async () => {
                  const current = await checkInventory(line)
                  onInventoryChange(line.productId, current)
                  if (current === "unavailable")
                    throw new Error("Sản phẩm hiện không còn bán.")
                  if (current === "error")
                    throw new Error(
                      "Chưa kiểm tra được tồn kho. Vui lòng thử lại."
                    )
                  await addCartItem(current, line.variantId, line.productId)
                })
              }
            >
              <PlusIcon aria-hidden="true" />
            </Button>
          </ButtonGroup>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={`Xóa ${label} khỏi giỏ`}
            tooltip="Xóa khỏi giỏ"
            disabled={pending}
            onClick={() => change(() => removeCartItem(line))}
          >
            <Trash2Icon aria-hidden="true" />
          </Button>
        </ItemActions>
        {canOrder && !pending ? (
          <Button
            size="sm"
            nativeButton={false}
            startIcon={<ShoppingBagIcon />}
            render={
              <Link
                href={productCheckoutHref(line.shopCode, line.productSlug, {
                  ...options,
                  cartQuantity: line.quantity,
                })}
                prefetch={false}
              />
            }
          >
            Đặt sản phẩm này
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            startIcon={<ShoppingBagIcon />}
            disabled
          >
            Đặt sản phẩm này
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}

function CartItems({ lines }: { lines: readonly CartLine[] }) {
  const [revision, setRevision] = useState(0)
  const products = [
    ...new Map(
      lines.map(({ productId, productSlug, shopCode }) => [
        productId,
        { productId, productSlug, shopCode },
      ])
    ).values(),
  ]
  const { data } = useApiQuery(
    JSON.stringify(["cart-inventory", products, revision]),
    () => loadCartInventory(products),
    { sessionSensitive: false }
  )
  const [updates, setUpdates] = useState<{
    base: typeof data
    inventory: Map<string, Inventory>
  } | null>(null)
  const inventoryFor = (id: string) =>
    (updates?.base === data ? updates?.inventory.get(id) : undefined) ??
    data?.get(id)
  const updateInventory = (productId: string, inventory: Inventory) => {
    setUpdates((previous) => ({
      base: data,
      inventory: new Map(
        previous?.base === data ? previous?.inventory : undefined
      ).set(productId, inventory),
    }))
  }
  useEffect(() => {
    const refresh = () => setRevision((previous) => previous + 1)
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) refresh()
    }
    window.addEventListener("focus", refresh)
    window.addEventListener("pageshow", onPageShow)
    return () => {
      window.removeEventListener("focus", refresh)
      window.removeEventListener("pageshow", onPageShow)
    }
  }, [])

  const subtotal = lines.reduce((sum, line) => {
    const snapshot = inventoryFor(line.productId)
    if (!snapshot || typeof snapshot !== "object") return sum
    const available = cartAvailability(snapshot.product, line.variantId, lines)
    if (!available || line.quantity > available.maxQuantity) return sum
    return (
      sum +
      productPricing(snapshot.product, available.variant).salePrice *
        line.quantity
    )
  }, 0)

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
      <ItemGroup>
        {lines.map((line) => (
          <CartRow
            key={cartLineKey(line)}
            line={line}
            lines={lines}
            inventory={inventoryFor(line.productId)}
            onInventoryChange={updateInventory}
          />
        ))}
      </ItemGroup>
      <Section title="Tạm tính các dòng đủ hàng">
        <ItemTitle className="text-xl text-primary" aria-live="polite">
          {data ? formatCurrency(subtotal) : "Đang kiểm tra…"}
        </ItemTitle>
        <ItemDescription className="line-clamp-none">
          Đặt từng sản phẩm để xác nhận phí giao hàng và áp dụng ưu đãi.
        </ItemDescription>
      </Section>
    </div>
  )
}

export function CartPage() {
  const lines = useCart()
  return (
    <section
      className="mx-auto max-w-5xl space-y-5"
      id="cart-heading"
      aria-label="Giỏ hàng"
    >
      <PageHeading title="Giỏ hàng" />
      {lines.length ? (
        <CartItems lines={lines} />
      ) : (
        <EmptyState
          title="Giỏ hàng đang trống"
          description="Chọn sản phẩm bạn muốn mua để thêm vào giỏ."
          action={
            <Button
              nativeButton={false}
              render={<Link href="/" />}
              startIcon={<ArrowRightIcon />}
            >
              Khám phá sản phẩm
            </Button>
          }
        />
      )}
    </section>
  )
}
