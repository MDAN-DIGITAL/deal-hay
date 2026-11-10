import type { Metadata } from "next"

import { SiteDocument, siteMetadata } from "@/components/layout/site-document"

export const metadata: Metadata = {
  ...siteMetadata,
  robots: { index: false, follow: false },
}

// Crossing this root layout ends AutoTag before checkout or account navigation.
export default function OfferLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <SiteDocument>{children}</SiteDocument>
}
