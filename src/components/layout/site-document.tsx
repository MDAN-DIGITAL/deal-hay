import type { Metadata } from "next"
import { Geist_Mono, Inter } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"

import "@/app/globals.css"
import { SiteShell } from "@/components/layout/site-shell"
import { SessionProvider } from "@/components/session-provider"
import { RealtimeRoot } from "@/components/realtime-root"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { GOOGLE_ADSENSE_CLIENT } from "@/config/advertising"
import { SITE_URL } from "@/config/site"
import { cn } from "@/lib/utils"

const inter = Inter({
  subsets: ["latin", "vietnamese"],
  variable: "--font-inter",
})
const fontMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })

export const siteMetadata: Metadata = {
  metadataBase: SITE_URL,
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Deal Hay", statusBarStyle: "default" },
  title: {
    default: "Deal Hay",
    template: "%s | Deal Hay",
  },
  description:
    "Khám phá sản phẩm, kết nối trực tiếp với cửa hàng uy tín và săn những deal hay mỗi ngày.",
  other: {
    "google-adsense-account": GOOGLE_ADSENSE_CLIENT,
  },
}

export function SiteDocument({
  children,
  advertising,
}: Readonly<{
  children: React.ReactNode
  advertising?: React.ReactNode
}>) {
  return (
    <html
      lang="vi"
      suppressHydrationWarning
      className={cn("antialiased", inter.variable, fontMono.variable)}
    >
      <body className="min-h-svh bg-background text-foreground">
        <ThemeProvider>
          <TooltipProvider>
            <SessionProvider>
              <RealtimeRoot>
                <SiteShell advertising={advertising}>{children}</SiteShell>
                <Toaster position="top-right" richColors />
              </RealtimeRoot>
            </SessionProvider>
          </TooltipProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
