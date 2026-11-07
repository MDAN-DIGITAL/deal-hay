"use client"

import { useParams, useSearchParams } from "next/navigation"

import { singleRouteQueryValue } from "@/lib/route-query"
import { ShopPageContainer } from "@/modules/public/containers/shop-page-container"

export function ShopPageContent() {
  const { shopUserCode } = useParams<{ shopUserCode: string }>()
  const searchParams = useSearchParams()

  return (
    <ShopPageContainer
      shopUserCode={shopUserCode}
      category={singleRouteQueryValue(searchParams, "category")}
      page={singleRouteQueryValue(searchParams, "page")}
    />
  )
}
