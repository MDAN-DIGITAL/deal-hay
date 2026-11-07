type SearchValues = { getAll: (name: string) => string[] }

/** Preserve repeated URL values so callers can reject ambiguous input. */
export function routeQueryValue(
  searchParams: SearchValues,
  name: string
): string | string[] | undefined {
  const values = searchParams.getAll(name)
  return values.length > 1 ? values : values[0]
}

export function singleRouteQueryValue(
  searchParams: SearchValues,
  name: string
): string | undefined {
  const value = routeQueryValue(searchParams, name)
  return typeof value === "string" ? value : undefined
}
