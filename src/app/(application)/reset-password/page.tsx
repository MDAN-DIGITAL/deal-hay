import type { Metadata } from "next"
import { Suspense } from "react"

import PageLoading from "@/components/layout/page-loading"
import { ResetPasswordPageContent } from "./content"

export const metadata: Metadata = { title: "Đặt lại mật khẩu" }

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <ResetPasswordPageContent />
    </Suspense>
  )
}
