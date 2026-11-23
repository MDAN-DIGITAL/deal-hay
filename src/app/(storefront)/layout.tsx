import { SiteDocument, siteMetadata } from "@/components/layout/site-document"
import { StorefrontAdvertising } from "@/components/storefront-advertising"
export const metadata = siteMetadata
export default function StorefrontLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <SiteDocument storefront advertising={<StorefrontAdvertising />}>
      {children}
    </SiteDocument>
  )
}
