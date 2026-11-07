import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { getPublicProduct, PUBLIC_CATALOG_ERROR } from "@/api/catalog/server"
import {
  absoluteSiteUrl,
  BRAND_OPEN_GRAPH_IMAGE,
  BRAND_TWITTER_IMAGE,
  productPath,
  productStructuredData,
  seoImageUrl,
  serializeJsonLd,
} from "@/lib/seo"
import { ProductPageContainer } from "@/modules/public/containers/product-page-container"
import {
  normalizeShopCouponCode,
  productCheckoutHref,
} from "@/modules/public/lib/product-checkout"

type ProductPageProps = {
  params: Promise<{ shopUserCode: string; productSlug: string }>
  searchParams: Promise<{
    discount_code?: string | string[]
    shop_coupon_code?: string | string[]
    variant_id?: string | string[]
  }>
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { shopUserCode, productSlug } = await params
  const canonical = absoluteSiteUrl(productPath(shopUserCode, productSlug))
  const result = await getPublicProduct(shopUserCode, productSlug)
  if (result.status !== "ready")
    return {
      title: "Chi tiết sản phẩm",
      alternates: { canonical },
    }
  const { product, shop } = result.data
  const description =
    product.description?.trim().replace(/\s+/g, " ").slice(0, 160) ||
    `Xem thông tin ${product.name} tại ${shop.name} và trao đổi trực tiếp với người bán trên Deal Hay.`
  const image = seoImageUrl(product.image_url)
  return {
    title: `${product.name} · ${shop.name}`,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      locale: "vi_VN",
      url: canonical,
      siteName: "Deal Hay",
      title: `${product.name} · ${shop.name}`,
      description,
      images: [
        image
          ? { url: image, alt: product.name }
          : {
              url: BRAND_OPEN_GRAPH_IMAGE,
              width: 1200,
              height: 630,
              alt: "Deal Hay – Mua sắm và săn deal tốt",
            },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${product.name} · ${shop.name}`,
      description,
      images: [image ?? BRAND_TWITTER_IMAGE],
    },
  }
}

export default async function ProductPage({
  params,
  searchParams,
}: ProductPageProps) {
  const [{ shopUserCode, productSlug }, query] = await Promise.all([
    params,
    searchParams,
  ])
  const initialDiscountCode =
    typeof query.discount_code === "string" && query.discount_code.length <= 80
      ? query.discount_code
      : undefined
  const initialShopCouponCode = normalizeShopCouponCode(query.shop_coupon_code)

  if (initialDiscountCode) {
    redirect(
      productCheckoutHref(shopUserCode, productSlug, {
        variantId: query.variant_id,
        discountCode: initialDiscountCode,
        shopCouponCode: initialShopCouponCode,
      })
    )
  }

  const result = await getPublicProduct(shopUserCode, productSlug)
  if (result.status === "not-found") notFound()
  const canonical = absoluteSiteUrl(productPath(shopUserCode, productSlug))
  return (
    <>
      {result.status === "ready" ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd(
              productStructuredData(result.data, canonical)
            ),
          }}
        />
      ) : null}
      <ProductPageContainer
        shopUserCode={shopUserCode}
        productSlug={productSlug}
        initialShopCouponCode={initialShopCouponCode}
        initialVariantId={
          typeof query.variant_id === "string" ? query.variant_id : undefined
        }
        initialData={result.status === "ready" ? result.data : undefined}
        initialError={
          result.status === "ready" ? undefined : PUBLIC_CATALOG_ERROR
        }
      />
    </>
  )
}
