import type { CheckoutProduct, PublicProductVariant } from "@/types/catalog"

export const cartQuantityLimit = 9999
export const cartHref = "/cart"

export type CartLine = {
  productId: string
  productSlug: string
  productName: string
  shopCode: string
  shopName: string
  variantId: string | null
  variantLabel: string
  quantity: number
}

export type CartLineId = Pick<CartLine, "productId" | "variantId">

export function cartLineKey({ productId, variantId }: CartLineId) {
  return JSON.stringify([productId, variantId])
}

export function productVariantLabel(variant: PublicProductVariant) {
  return (
    variant.variant_label ||
    Object.values(variant.option_values).join(" · ") ||
    variant.sku
  )
}

export function cartAvailability(
  product: CheckoutProduct,
  variantId: string | null,
  lines: readonly CartLine[]
) {
  const variants = product.variants.filter((variant) => variant.is_active)
  const hasVariants = product.has_variants || product.variants.length > 0
  const variant = variants.find((item) => item.id === variantId)
  if ((hasVariants && !variant) || (variantId !== null && !variant)) return null

  const stock = variant?.stock ?? product.stock
  let otherQuantity = 0
  for (const line of lines) {
    if (line.productId !== product.id || line.variantId === variantId) continue
    const other = variants.find((item) => item.id === line.variantId)
    if (other) otherQuantity += Math.min(line.quantity, other.stock)
  }

  // The product count is the shared pool or the sum of active variant counts.
  // Applying both ceilings works for either inventory model.
  const maxQuantity = Math.max(
    0,
    Math.min(stock, product.stock - otherQuantity, cartQuantityLimit)
  )
  const quantity =
    lines.find(
      (line) => line.productId === product.id && line.variantId === variantId
    )?.quantity ?? 0

  return {
    variant,
    stock,
    maxQuantity,
    remaining: Math.max(0, maxQuantity - quantity),
  }
}

export function parseCartQuantity(value: string | undefined) {
  if (!value || !/^[1-9]\d{0,3}$/.test(value)) return undefined
  return Number(value)
}

function isCartLine(value: unknown): value is CartLine {
  if (!value || typeof value !== "object") return false
  const item = value as Partial<CartLine>
  return (
    typeof item.productId === "string" &&
    item.productId.length > 0 &&
    typeof item.productSlug === "string" &&
    item.productSlug.length > 0 &&
    item.productSlug !== "." &&
    item.productSlug !== ".." &&
    typeof item.shopCode === "string" &&
    item.shopCode.length > 0 &&
    item.shopCode !== "." &&
    item.shopCode !== ".." &&
    typeof item.productName === "string" &&
    typeof item.shopName === "string" &&
    (item.variantId === null || typeof item.variantId === "string") &&
    typeof item.variantLabel === "string" &&
    typeof item.quantity === "number" &&
    Number.isInteger(item.quantity) &&
    item.quantity > 0 &&
    item.quantity <= cartQuantityLimit
  )
}

export function readCartLines(raw: string | null): CartLine[] {
  if (!raw) return []
  try {
    const value: unknown = JSON.parse(raw)
    if (!Array.isArray(value)) return []
    const lines = new Map<string, CartLine>()
    for (const item of value) {
      if (isCartLine(item)) lines.set(cartLineKey(item), item)
    }
    return [...lines.values()]
  } catch {
    return []
  }
}
