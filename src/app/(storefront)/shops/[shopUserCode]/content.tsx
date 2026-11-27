"use client"

import { useParams } from "next/navigation"

import { ShopPageContainer } from "@/modules/public/containers/shop-page-container"

export function PublicShopPageContent() {
  const { shopUserCode } = useParams<{ shopUserCode: string }>()

  return <ShopPageContainer shopUserCode={shopUserCode} />
}
