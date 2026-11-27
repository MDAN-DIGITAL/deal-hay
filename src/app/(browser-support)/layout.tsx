import type { ReactNode } from "react"

import "@/app/globals.css"
import { ClientRenderBoundary } from "@/components/layout/client-render-boundary"
import { siteFontVariables } from "@/components/layout/site-fonts"

export default function BrowserSupportLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <html lang="vi" className={siteFontVariables}>
      <body>
        <ClientRenderBoundary>{children}</ClientRenderBoundary>
      </body>
    </html>
  )
}
