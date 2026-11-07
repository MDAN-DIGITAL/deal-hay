import type { Metadata } from "next"

import { SiteDocument, siteMetadata } from "@/components/layout/site-document"

export const metadata: Metadata = {
  ...siteMetadata,
  robots: { index: false, follow: false },
}

export default function ApplicationLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <SiteDocument>{children}</SiteDocument>
}
