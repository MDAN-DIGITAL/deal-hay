"use client"

import { Suspense } from "react"
import { usePathname, useSearchParams } from "next/navigation"

import { singleRouteQueryValue } from "@/lib/route-query"
import { CatalogSearchForm } from "@/modules/public/components/catalog-search-form"
import { catalogSearch } from "@/modules/public/lib/catalog-query"

function ProductSearch({
  search = "",
  action = "/search",
}: {
  search?: string
  action?: string
}) {
  return (
    <CatalogSearchForm
      compact
      action={action}
      search={search}
      label="Tìm sản phẩm"
      placeholder="Tên hoặc mã sản phẩm"
    />
  )
}

function CurrentProductSearch() {
  const pathname = usePathname()
  const params = useSearchParams()
  const onCategory = /^\/categories\/[^/]+$/.test(pathname)
  const onSearch = pathname === "/search"
  const search =
    onCategory || onSearch
      ? catalogSearch(singleRouteQueryValue(params, "q"))
      : undefined
  const action = onCategory ? pathname : "/search"

  return (
    <ProductSearch
      key={JSON.stringify([pathname, search, action])}
      search={search}
      action={action}
    />
  )
}

export function StorefrontSearch() {
  return (
    <Suspense fallback={<ProductSearch />}>
      <CurrentProductSearch />
    </Suspense>
  )
}
