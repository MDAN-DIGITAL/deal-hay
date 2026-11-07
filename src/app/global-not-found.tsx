import type { Metadata } from "next"

import "@/app/globals.css"
import NotFound from "@/components/layout/page-not-found"
import { SITE_URL } from "@/config/site"

export const metadata: Metadata = {
  metadataBase: SITE_URL,
  title: "Không tìm thấy trang | Deal Hay",
  robots: { index: false, follow: false },
}

export default function GlobalNotFound() {
  return (
    <html lang="vi">
      <body className="bg-background text-foreground">
        <main className="mx-auto max-w-3xl px-4 py-10">
          <NotFound />
        </main>
      </body>
    </html>
  )
}
