import type { Metadata } from "next"

import { getPublicHome, PUBLIC_CATALOG_ERROR } from "@/api/catalog/server"
import { HomePageContainer } from "@/modules/public/containers/home-page-container"

export const metadata: Metadata = {
  title: "Trang chủ",
  description:
    "Khám phá sản phẩm và gian hàng trên Deal Hay, xem thông tin sản phẩm và trao đổi trực tiếp với người bán.",
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ category?: string | string[] }>
}) {
  const query = await searchParams
  const category =
    typeof query.category === "string" ? query.category : undefined
  const result = await getPublicHome(category)
  return (
    <HomePageContainer
      category={category}
      initialData={result.status === "ready" ? result.data : undefined}
      initialError={
        result.status === "ready" ? undefined : PUBLIC_CATALOG_ERROR
      }
    />
  )
}
