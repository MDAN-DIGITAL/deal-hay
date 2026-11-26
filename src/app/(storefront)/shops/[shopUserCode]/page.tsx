import type { Metadata } from "next"
import { notFound } from "next/navigation"

import {
  getPublicShop,
  PUBLIC_CATALOG_ERROR,
} from "@/api/catalog/server"
import { ShopPageContainer } from "@/modules/public/containers/shop-page-container"

export const metadata: Metadata = { title: "Gian hàng" }

export function generateStaticParams() {
  return []
}

export default async function ShopPage({
  params,
}: {
  params: Promise<{ shopUserCode: string }>
}) {
  const { shopUserCode } = await params
  const result = await getPublicShop(shopUserCode)
  if (result.status === "not-found") notFound()

  return (
    <ShopPageContainer
      shopUserCode={shopUserCode}
      initialData={result.status === "ready" ? result.data : undefined}
      initialError={result.status === "ready" ? undefined : PUBLIC_CATALOG_ERROR}
    />
  )
}
