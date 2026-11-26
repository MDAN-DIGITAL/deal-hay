import type { Metadata } from "next"
import { permanentRedirect } from "next/navigation"

import {
  BRAND_OPEN_GRAPH_IMAGE,
  BRAND_TWITTER_IMAGE,
  serializeJsonLd,
  SITE_DESCRIPTION,
  siteStructuredData,
} from "@/lib/seo"
import {
  parsePublicCatalogQuery,
  PublicCatalogPage,
  type PublicCatalogSearchParams,
} from "@/modules/public/containers/public-catalog-page"
import { catalogUrl } from "@/modules/public/lib/catalog-url"

export const metadata: Metadata = {
  title: { absolute: "Deal Hay – Săn deal tốt từ các shop uy tín" },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "vi_VN",
    url: "/",
    siteName: "Deal Hay",
    title: "Deal Hay – Săn deal tốt từ các shop uy tín",
    description: SITE_DESCRIPTION,
    images: [
      {
        url: BRAND_OPEN_GRAPH_IMAGE,
        width: 1200,
        height: 630,
        alt: "Deal Hay – Săn deal tốt từ các shop uy tín",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Deal Hay – Săn deal tốt từ các shop uy tín",
    description: SITE_DESCRIPTION,
    images: [BRAND_TWITTER_IMAGE],
  },
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<PublicCatalogSearchParams>
}) {
  const query = await searchParams
  const legacyCategory =
    typeof query.category === "string"
      ? query.category.trim().slice(0, 120) || undefined
      : undefined
  const parsed = parsePublicCatalogQuery(query)

  if (legacyCategory || parsed.search)
    permanentRedirect(
      catalogUrl({
        category: legacyCategory,
        search: parsed.search,
        filters: parsed.filters,
      })
    )

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(siteStructuredData()),
        }}
      />
      <PublicCatalogPage query={parsed} />
    </>
  )
}
