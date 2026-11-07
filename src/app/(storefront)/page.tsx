import type { Metadata } from "next"

import { getPublicHome, PUBLIC_CATALOG_ERROR } from "@/api/catalog/server"
import {
  BRAND_OPEN_GRAPH_IMAGE,
  BRAND_TWITTER_IMAGE,
  serializeJsonLd,
  SITE_DESCRIPTION,
  siteStructuredData,
} from "@/lib/seo"
import { HomePageContainer } from "@/modules/public/containers/home-page-container"

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
  searchParams: Promise<{ category?: string | string[] }>
}) {
  const query = await searchParams
  const category =
    typeof query.category === "string" ? query.category : undefined
  const result = await getPublicHome(category)
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(siteStructuredData()),
        }}
      />
      <HomePageContainer
        category={category}
        initialData={result.status === "ready" ? result.data : undefined}
        initialError={
          result.status === "ready" ? undefined : PUBLIC_CATALOG_ERROR
        }
      />
    </>
  )
}
