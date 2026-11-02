import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { getPublicProduct, PUBLIC_CATALOG_ERROR } from "@/api/catalog/server"
import { ProductPageContainer } from "@/modules/public/containers/product-page-container"
import { productCheckoutHref } from "@/modules/public/lib/product-checkout"

type ProductPageProps = {
  params: Promise<{ shopUserCode: string; productSlug: string }>
  searchParams: Promise<{
    discount_code?: string | string[]
    variant_id?: string | string[]
  }>
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { shopUserCode, productSlug } = await params
  const result = await getPublicProduct(shopUserCode, productSlug)
  if (result.status !== "ready") return { title: "Chi tiết sản phẩm" }
  const { product, shop } = result.data
  return {
    title: `${product.name} · ${shop.name}`,
    description:
      product.description?.trim().replace(/\s+/g, " ").slice(0, 160) ||
      `Xem thông tin ${product.name} tại ${shop.name} và trao đổi trực tiếp với người bán trên Deal Hay.`,
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

  if (initialDiscountCode) {
    redirect(
      productCheckoutHref(shopUserCode, productSlug, {
        variantId: query.variant_id,
        discountCode: initialDiscountCode,
      })
    )
  }

  const result = await getPublicProduct(shopUserCode, productSlug)
  if (result.status === "not-found") notFound()
  return (
    <ProductPageContainer
      shopUserCode={shopUserCode}
      productSlug={productSlug}
      initialVariantId={
        typeof query.variant_id === "string" ? query.variant_id : undefined
      }
      initialData={result.status === "ready" ? result.data : undefined}
      initialError={
        result.status === "ready" ? undefined : PUBLIC_CATALOG_ERROR
      }
    />
  )
}
