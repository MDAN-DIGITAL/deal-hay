import type { Metadata } from "next"
import { Suspense } from "react"

import PageLoading from "@/components/layout/page-loading"
import { SignUpPageContent } from "./content"

export const metadata: Metadata = { title: "Đăng ký" }

export default function SignUpPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <SignUpPageContent />
    </Suspense>
  )
}
