export type CatalogUrlFilters = {
  sort?: string
  minPrice?: number
  maxPrice?: number
  inStock?: boolean
  onSale?: boolean
  liked?: boolean
}

export type CatalogUrlState = {
  category?: string
  search?: string
  filters?: CatalogUrlFilters
}

export function catalogCategorySlug(category: string): string {
  return category
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function catalogUrl({
  category = "",
  search = "",
  filters = {},
}: CatalogUrlState = {}): string {
  const categorySlug = catalogCategorySlug(category)
  const path = categorySlug
    ? `/categories/${categorySlug}`
    : search
      ? "/search"
      : "/"
  const params = new URLSearchParams()

  if (search) params.set("q", search)
  if (filters.sort && filters.sort !== "recommended")
    params.set("sort", filters.sort)
  if (filters.minPrice !== undefined)
    params.set("min_price", String(filters.minPrice))
  if (filters.maxPrice !== undefined)
    params.set("max_price", String(filters.maxPrice))
  if (filters.inStock) params.set("in_stock", "1")
  if (filters.onSale) params.set("on_sale", "1")
  if (filters.liked) params.set("liked", "1")

  const query = params.toString()
  return query ? `${path}?${query}` : path
}
