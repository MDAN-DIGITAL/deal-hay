import type {
  FeaturedShop,
  CheckoutProduct,
  CheckoutShop,
  HomeProduct,
  ProductReview,
  ProductReviewSummary,
  PublicProduct,
  PublicProductSummary,
  PublicShop,
} from "@/types/catalog"
import type { PaginatedResponse } from "@/types/common"

export type HomeResponse = {
  featuredShops: FeaturedShop[]
  products: PaginatedResponse<HomeProduct> & {
    current_page: number
    last_page: number
  }
  categories: string[]
  filters: { category: string; q?: string }
}

export type PublicShopsResponse = {
  shops: PaginatedResponse<FeaturedShop>
  filters: { q: string }
}

export type ShopResponse = {
  shop: PublicShop
  products: PublicProductSummary[]
  categories: string[]
  metrics?: Record<string, unknown>
  viewerState?: Record<string, unknown>
}

export type CheckoutProductResponse = {
  shop: CheckoutShop
  product: CheckoutProduct
}

export type ProductResponse = {
  shop: PublicShop
  product: PublicProduct
  relatedProducts: PublicProductSummary[]
  reviews: ProductReview[]
  reviewSummary: ProductReviewSummary
  canReview: boolean
  viewerReview: ProductReview | null
}
