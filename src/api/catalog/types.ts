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

export type CatalogSort =
  | "recommended"
  | "popular"
  | "newest"
  | "best_selling"
  | "price_asc"
  | "price_desc"

export type HomeCatalogFilters = {
  sort: CatalogSort
  min_price: number | null
  max_price: number | null
  in_stock: boolean
  on_sale: boolean
  liked: boolean
}

export type HomeCatalogRequest = {
  category?: string
  categorySlug?: string
  page?: string
  q?: string
  sort?: CatalogSort
  minPrice?: number
  maxPrice?: number
  inStock?: boolean
  onSale?: boolean
  liked?: boolean
}

export type HomeResponse = {
  featuredShops: FeaturedShop[]
  products: PaginatedResponse<HomeProduct> & {
    current_page: number
    last_page: number
  }
  categories: string[]
  filters: { category: string; q: string } & HomeCatalogFilters
  personalized?: boolean
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
