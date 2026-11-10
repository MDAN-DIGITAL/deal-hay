import type { PublicProductSummary, ProductVariant } from "@/types/catalog"

type ProductPrices = Pick<
  PublicProductSummary,
  "price" | "display_price" | "old_price" | "display_original_price"
>

/** Reference prices never change the sale amount used at checkout. */
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
  return {
    salePrice,
    originalPrice,
  }
}
