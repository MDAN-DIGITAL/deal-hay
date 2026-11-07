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
import {
  BRAND_OPEN_GRAPH_IMAGE,
  BRAND_TWITTER_IMAGE,
  SITE_DESCRIPTION,
  SITE_NAME,
} from "@/lib/seo"
import { cn } from "@/lib/utils"

const inter = Inter({
  subsets: ["latin", "vietnamese"],
  variable: "--font-inter",
})
const fontMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })

export const siteMetadata: Metadata = {
  metadataBase: SITE_URL,
  applicationName: SITE_NAME,
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: "default" },
  title: {
    default: "Deal Hay – Mua sắm và săn deal tốt",
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  category: "shopping",
  creator: SITE_NAME,
  publisher: SITE_NAME,
  formatDetection: { telephone: false, address: false, email: false },
  openGraph: {
    type: "website",
    locale: "vi_VN",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: "Deal Hay – Mua sắm và săn deal tốt",
    description: SITE_DESCRIPTION,
    images: [
      {
        url: BRAND_OPEN_GRAPH_IMAGE,
        width: 1200,
        height: 630,
        alt: "Deal Hay – Mua sắm và săn deal tốt",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Deal Hay – Mua sắm và săn deal tốt",
    description: SITE_DESCRIPTION,
    images: [BRAND_TWITTER_IMAGE],
  },
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
