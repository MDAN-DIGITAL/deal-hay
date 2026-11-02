import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { getPublicShop, PUBLIC_CATALOG_ERROR } from "@/api/catalog/server"
import { ShopPageContainer } from "@/modules/public/containers/shop-page-container"

type ShopPageProps = {
  params: Promise<{ shopUserCode: string }>
  searchParams: Promise<{
    category?: string | string[]
    page?: string | string[]
  }>
}

async function loadShopPage({ params, searchParams }: ShopPageProps) {
  const [{ shopUserCode }, query] = await Promise.all([params, searchParams])
  const category =
    typeof query.category === "string" ? query.category : undefined
  const page = typeof query.page === "string" ? query.page : undefined
  return {
    shopUserCode,
    category,
    page,
    result: await getPublicShop(shopUserCode, category, page),
  }
}

export async function generateMetadata(
  props: ShopPageProps
): Promise<Metadata> {
  const { result } = await loadShopPage(props)
  return result.status === "ready"
    ? {
        title: result.data.shop.name,
        description:
          `Khám phá sản phẩm tại ${result.data.shop.name} trên Deal Hay. ${result.data.shop.address}`.trim(),
      }
    : { title: "Gian hàng" }
}

export default async function ShopPage(props: ShopPageProps) {
  const { shopUserCode, category, page, result } = await loadShopPage(props)
  if (result.status === "not-found") notFound()
  return (
    <ShopPageContainer
      shopUserCode={shopUserCode}
      category={category}
      page={page}
      initialData={result.status === "ready" ? result.data : undefined}
      initialError={
        result.status === "ready" ? undefined : PUBLIC_CATALOG_ERROR
      }
    />
  )
}
