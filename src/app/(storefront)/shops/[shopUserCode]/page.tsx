import type { Metadata } from "next"

import { PublicShopPageContent } from "./content"

export const metadata: Metadata = { title: "Gian hàng" }

export function generateStaticParams() {
  return []
}

export default function ShopPage() {
  return <PublicShopPageContent />
}
