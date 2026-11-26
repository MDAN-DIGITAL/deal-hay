export const CATALOG_SEARCH_MAX_LENGTH = 120
export const CATALOG_MAX_PRICE = 1_000_000_000

export const CATALOG_SORTS = [
  "recommended",
  "popular",
  "newest",
  "best_selling",
  "price_asc",
  "price_desc",
] as const

export type CatalogSort = (typeof CATALOG_SORTS)[number]

type QueryValue = string | string[] | undefined

export function catalogSearch(value: QueryValue): string | undefined {
  if (typeof value !== "string") return
  return (
    value.trim().replace(/\s+/g, " ").slice(0, CATALOG_SEARCH_MAX_LENGTH) ||
    undefined
  )
}

export function catalogPage(value: QueryValue): string | undefined {
  if (
    typeof value === "string" &&
    /^[1-9]\d*$/.test(value) &&
    Number.isSafeInteger(Number(value))
  )
    return value
}

export function catalogSort(value: QueryValue): CatalogSort {
  return typeof value === "string" &&
    CATALOG_SORTS.includes(value as CatalogSort)
    ? (value as CatalogSort)
    : "recommended"
}

export function catalogPrice(value: QueryValue): number | undefined {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return
  const price = Number(value)
  if (!Number.isSafeInteger(price) || price > CATALOG_MAX_PRICE) return
  return price
}

export function catalogFlag(value: QueryValue): boolean {
  return value === "1" || value === "true"
}
