import { defaultProductVariant } from "@/modules/public/lib/variant-selection"
import type { PublicProduct, PublicProductVariant } from "@/types/catalog"

type ProductNavigationOptions = {
  variantId?: string | string[]
  discountCode?: string
  shopCouponCode?: string
}

function productPath(shopUserCode: string, productSlug: string): string {
  return `/shops/${encodeURIComponent(shopUserCode)}/products/${encodeURIComponent(productSlug)}`
}

function productQuery(options: ProductNavigationOptions): string {
  const query = new URLSearchParams()
  const variantIds = Array.isArray(options.variantId)
    ? options.variantId
    : options.variantId === undefined
      ? []
      : [options.variantId]

  for (const variantId of variantIds) query.append("variant_id", variantId)
  if (options.discountCode) query.set("discount_code", options.discountCode)
  if (options.shopCouponCode)
    query.set("shop_coupon_code", options.shopCouponCode)

  return query.toString()
}

export function productDetailHref(
  shopUserCode: string,
  productSlug: string,
  options: Pick<ProductNavigationOptions, "variantId" | "shopCouponCode"> = {}
): string {
  const query = productQuery(options)
  const path = productPath(shopUserCode, productSlug)

  return query ? `${path}?${query}` : path
}

export function productCheckoutHref(
  shopUserCode: string,
  productSlug: string,
  options: ProductNavigationOptions & { cartQuantity?: number } = {}
): string {
  const params = new URLSearchParams(productQuery(options))
  if (options.cartQuantity !== undefined)
    params.set("cart_quantity", String(options.cartQuantity))
  const query = params.toString()
  const path = `${productPath(shopUserCode, productSlug)}/checkout`
  return query ? `${path}?${query}` : path
}

export function productOfferHref(
  shopUserCode: string,
  productSlug: string,
  options: ProductNavigationOptions = {}
): string {
  const query = productQuery(options)
  const path = `${productPath(shopUserCode, productSlug)}/offer`
  return query ? `${path}?${query}` : path
}

export function normalizeShopCouponCode(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const normalized = value.trim().toUpperCase()

  return normalized.length > 0 && normalized.length <= 40
    ? normalized
    : undefined
}

export function resolveCheckoutVariant(
  product: Pick<PublicProduct, "has_variants" | "variants">,
  variantId?: string | string[]
): { variant?: PublicProductVariant; invalidVariant: boolean } {
  if (variantId !== undefined) {
    const variant =
      typeof variantId === "string"
        ? product.variants.find(
            (candidate) => candidate.id === variantId && candidate.is_active
          )
        : undefined

    return { variant, invalidVariant: !variant }
  }

  return {
    variant:
      product.has_variants || product.variants.length > 0
        ? defaultProductVariant(product.variants)
        : undefined,
    invalidVariant: false,
  }
}
