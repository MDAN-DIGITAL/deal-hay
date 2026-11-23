export const CATALOG_SEARCH_MAX_LENGTH = 120

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
