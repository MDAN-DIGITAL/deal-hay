import type { ProductResponse } from "@/api/catalog/types"
import { apiAssetUrl } from "@/config/env"
import { SITE_URL } from "@/config/site"
import { defaultProductVariant } from "@/modules/public/lib/variant-selection"

export const SITE_NAME = "Deal Hay"
export const SITE_ALTERNATE_NAME = "DealHay"
export const SITE_DESCRIPTION =
  "Khám phá sản phẩm, kết nối trực tiếp với cửa hàng uy tín và săn những deal hay mỗi ngày."

export function absoluteSiteUrl(path = "/"): string {
  return new URL(path, SITE_URL).href
}

export const BRAND_OPEN_GRAPH_IMAGE = absoluteSiteUrl("/dealhay-social.png")
export const BRAND_TWITTER_IMAGE = BRAND_OPEN_GRAPH_IMAGE

export function shopPath(shopUserCode: string): string {
  return `/shops/${encodeURIComponent(shopUserCode)}`
}

export function productPath(shopUserCode: string, productSlug: string): string {
  return `${shopPath(shopUserCode)}/products/${encodeURIComponent(productSlug)}`
}

export function seoImageUrl(value: string | null | undefined): string | null {
  const normalized = apiAssetUrl(value?.trim())
  if (!normalized) return null

  try {
    const url = new URL(normalized)
    return ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
      ? url.href
      : null
  } catch {
    return null
  }
}

export function siteStructuredData() {
  const home = absoluteSiteUrl()
  const logo = absoluteSiteUrl("/dealhay-logo.svg")
  const organizationId = `${home}#organization`

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${home}#website`,
        url: home,
        name: SITE_NAME,
        alternateName: SITE_ALTERNATE_NAME,
        description: SITE_DESCRIPTION,
        inLanguage: "vi-VN",
        publisher: { "@id": organizationId },
      },
      {
        "@type": "OnlineStore",
        "@id": organizationId,
        url: home,
        name: SITE_NAME,
        alternateName: SITE_ALTERNATE_NAME,
        description: SITE_DESCRIPTION,
        logo: {
          "@type": "ImageObject",
          url: logo,
          contentUrl: logo,
          width: 512,
          height: 512,
          caption: SITE_NAME,
        },
      },
    ],
  }
}

export function productStructuredData(
  data: ProductResponse,
  canonicalUrl: string
) {
  const { product, shop } = data
  const shopUrl = absoluteSiteUrl(shopPath(shop.code))
  const selectedVariant = defaultProductVariant(product.variants)
  const price = selectedVariant?.price ?? product.price
  const inStock = selectedVariant
    ? selectedVariant.stock > 0
    : product.stock > 0
  const images = Array.from(
    new Set(
      [product.image_url, ...product.images.map((image) => image.image_url)]
        .map(seoImageUrl)
        .filter((image): image is string => image !== null)
    )
  )
  const productNode: Record<string, unknown> = {
    "@type": "Product",
    "@id": `${canonicalUrl}#product`,
    url: canonicalUrl,
    name: product.name,
    category: product.category,
    offers: {
      "@type": "Offer",
      url: canonicalUrl,
      price: Number.isFinite(price) && price >= 0 ? price : product.price,
      priceCurrency: "VND",
      availability: inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      seller: {
        "@type": "Organization",
        name: shop.name,
        url: shopUrl,
      },
    },
  }
  const description = product.description?.trim().replace(/\s+/g, " ")
  if (description) productNode.description = description
  const sku = selectedVariant?.sku?.trim() || product.sku?.trim()
  if (sku) productNode.sku = sku
  if (images.length > 0) productNode.image = images

  return {
    "@context": "https://schema.org",
    "@graph": [
      productNode,
      {
        "@type": "BreadcrumbList",
        "@id": `${canonicalUrl}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Trang chủ",
            item: absoluteSiteUrl(),
          },
          {
            "@type": "ListItem",
            position: 2,
            name: shop.name,
            item: shopUrl,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: product.name,
            item: canonicalUrl,
          },
        ],
      },
    ],
  }
}

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c")
}
