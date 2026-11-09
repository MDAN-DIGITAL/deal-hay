import type { PublicProductSummary, ProductVariant } from "@/types/catalog"

export const PRODUCT_AD_DISCOUNT_PERCENT = 25

type ProductPrices = Pick<
  PublicProductSummary,
  "price" | "display_price" | "old_price" | "display_original_price"
>

/** A preview only: checkout applies discounts after the API verifies a code. */
export function productPricing(
  product: ProductPrices,
  variant?: Pick<ProductVariant, "price">
) {
  const salePrice = variant
    ? (variant.price ?? product.price)
    : (product.display_price ?? product.price)
  const referencePrice = product.old_price ?? product.display_original_price
  const originalPrice =
    referencePrice != null && referencePrice > salePrice ? referencePrice : null
  // Match the API's half-up rounding of the discount, including odd VND prices.
  const adDiscount =
    Number.isSafeInteger(salePrice) && salePrice >= 0
      ? Number(
          (BigInt(salePrice) * BigInt(PRODUCT_AD_DISCOUNT_PERCENT) +
            BigInt(50)) /
            BigInt(100)
        )
      : 0

  return {
    salePrice,
    originalPrice,
    adDiscount,
    afterAdPrice: salePrice - adDiscount,
    adDiscountPercent: PRODUCT_AD_DISCOUNT_PERCENT,
  }
}
