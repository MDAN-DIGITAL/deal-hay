import type { Metadata } from "next"
import { Suspense } from "react"

import PageLoading from "@/components/layout/page-loading"
import { ConversationPageContent } from "./content"

export const metadata: Metadata = { title: "Cuộc trò chuyện" }

export function generateStaticParams() {
  return []
}

export default function ConversationPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <ConversationPageContent />
    </Suspense>
  )
}
