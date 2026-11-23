import type { Metadata } from "next"

import { CartPage } from "@/modules/cart/components/cart-page"

export const metadata: Metadata = {
  title: "Giỏ hàng",
  robots: { index: false, follow: false },
}

export default function Page() {
  return <CartPage />
}
