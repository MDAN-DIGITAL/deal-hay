import type { Metadata } from "next"
import { AuthGuard } from "@/components/session-provider"
import { DiscountCodesPageContainer } from "@/modules/discount-codes/containers/discount-codes-page-container"

export const metadata: Metadata = { title: "Mã giảm giá của tôi" }

export default function DiscountCodesPage() {
  return (
    <AuthGuard>
      <DiscountCodesPageContainer />
    </AuthGuard>
  )
}
