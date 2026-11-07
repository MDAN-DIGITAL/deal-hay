import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { getPublicShop, PUBLIC_CATALOG_ERROR } from "@/api/catalog/server"
import {
  absoluteSiteUrl,
  BRAND_OPEN_GRAPH_IMAGE,
  BRAND_TWITTER_IMAGE,
  seoImageUrl,
  shopPath,
} from "@/lib/seo"
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
  const { shopUserCode, result } = await loadShopPage(props)
  const path = shopPath(shopUserCode)
  const canonical = absoluteSiteUrl(path)
  const fallback: Metadata = {
    title: "Gian hàng",
    alternates: { canonical },
  }
  if (result.status !== "ready") return fallback

  const { shop } = result.data
  const description =
    `Khám phá sản phẩm tại ${shop.name} trên Deal Hay. ${shop.address}`.trim()
  const image = seoImageUrl(shop.avatar_url)
  return {
    title: shop.name,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      locale: "vi_VN",
      url: canonical,
      siteName: "Deal Hay",
      title: `${shop.name} | Deal Hay`,
      description,
      images: [
        image
          ? { url: image, alt: shop.name }
          : {
              url: BRAND_OPEN_GRAPH_IMAGE,
              width: 1200,
              height: 630,
              alt: "Deal Hay – Mua sắm và săn deal tốt",
            },
      ],
    },
    twitter: {
      card: "summary",
      title: `${shop.name} | Deal Hay`,
      description: `Khám phá sản phẩm tại ${shop.name} trên Deal Hay.`,
      images: [image ?? BRAND_TWITTER_IMAGE],
    },
  }
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
