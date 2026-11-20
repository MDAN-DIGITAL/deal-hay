import type { ReactNode } from "react"

import "@/app/globals.css"
import { siteFontVariables } from "@/components/layout/site-fonts"

export default function BrowserSupportLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <html lang="vi" className={siteFontVariables}>
      <body>{children}</body>
    </html>
  )
}
