import { apiFetch } from "@/api/client"
import { catalogRoutes } from "@/api/catalog/routes"
import type {
  CheckoutProductResponse,
  HomeCatalogRequest,
  HomeResponse,
  ProductResponse,
  ShopResponse,
} from "@/api/catalog/types"

export function getHome({
  category,
  categorySlug,
  page,
  q,
  sort,
  minPrice,
  maxPrice,
  inStock,
  onSale,
  liked,
}: HomeCatalogRequest = {}): Promise<HomeResponse> {
  return apiFetch({
    path: catalogRoutes.home,
    searchParams: {
      category,
      category_slug: categorySlug,
      page,
      q,
      sort: sort === "recommended" ? undefined : sort,
      min_price: minPrice,
      max_price: maxPrice,
      in_stock: inStock ? 1 : undefined,
      on_sale: onSale ? 1 : undefined,
      liked: liked ? 1 : undefined,
    },
  })
}

export function getShop(
  shopUserCode: string,
  category?: string,
  page?: string
): Promise<ShopResponse> {
  return apiFetch({
    path: catalogRoutes.shop(shopUserCode),
    searchParams: { category, page },
  })
}

export function getProduct(
  shopUserCode: string,
  productSlug: string
): Promise<ProductResponse> {
  return apiFetch({ path: catalogRoutes.product(shopUserCode, productSlug) })
}

export function getCheckoutProduct(
  shopUserCode: string,
  productSlug: string
): Promise<CheckoutProductResponse> {
  return apiFetch({
    path: catalogRoutes.product(
      encodeURIComponent(shopUserCode),
      encodeURIComponent(productSlug)
    ),
    searchParams: { view: "checkout" },
  })
}
