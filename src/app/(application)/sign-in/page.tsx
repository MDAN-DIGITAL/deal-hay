import type { Metadata } from "next"
import { Suspense } from "react"

import PageLoading from "@/components/layout/page-loading"
import { SignInPageContent } from "./content"

export const metadata: Metadata = { title: "Đăng nhập" }

export default function SignInPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <SignInPageContent />
    </Suspense>
  )
}
