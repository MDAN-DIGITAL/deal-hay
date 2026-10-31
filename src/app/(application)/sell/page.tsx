import type { Metadata } from "next"

import { AuthenticatedSellPage } from "./content"

export const metadata: Metadata = { title: "Bán hàng" }

export default function SellPage() {
  return <AuthenticatedSellPage />
}
