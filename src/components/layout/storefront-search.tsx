"use client"

import { Suspense } from "react"
import { usePathname, useSearchParams } from "next/navigation"

import { singleRouteQueryValue } from "@/lib/route-query"
import { CatalogSearchForm } from "@/modules/public/components/catalog-search-form"
import { catalogSearch } from "@/modules/public/lib/catalog-query"

function ProductSearch({
  search = "",
  category,
}: {
  search?: string
  category?: string
}) {
  return (
    <CatalogSearchForm
      compact
      action="/#san-pham"
      search={search}
      category={category}
      label="Tìm sản phẩm"
      placeholder="Tên hoặc mã sản phẩm"
    />
  )
}

function CurrentProductSearch() {
  const pathname = usePathname()
  const params = useSearchParams()
  const onCatalog = pathname === "/"
  const search = onCatalog
    ? catalogSearch(singleRouteQueryValue(params, "q"))
    : undefined
  const category = onCatalog
    ? singleRouteQueryValue(params, "category")
    : undefined

  return (
    <ProductSearch
      key={JSON.stringify([pathname, search, category])}
      search={search}
      category={category}
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
