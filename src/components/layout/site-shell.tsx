"use client"

import { usePathname } from "next/navigation"
import { SiteHeader } from "@/components/layout/site-header"
import { SiteFooter } from "@/components/layout/site-footer"
import { cn } from "@/lib/utils"

export function SiteShell({
  children,
  advertising,
  storefront,
}: {
  children: React.ReactNode
  advertising?: React.ReactNode
  storefront?: boolean
}) {
  const pathname = usePathname()
  const shopManagement =
    pathname === "/shop-manage" || pathname.startsWith("/shop-manage/")
  const chat = pathname === "/chats" || pathname.startsWith("/chats/")
  const admin = pathname === "/admin" || pathname.startsWith("/admin/")

  if (shopManagement || admin)
    return <div className="min-h-svh">{children}</div>

  return (
    <div className="flex min-h-svh flex-col">
      {!chat ? <SiteHeader storefront={storefront} /> : null}
      <main
        className={
          chat
            ? "chat-surface h-dvh min-h-0 w-full overflow-hidden bg-background text-foreground"
            : cn(
                "mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 lg:px-8",
                storefront ? "py-4 sm:py-6" : "py-6 sm:py-8"
              )
        }
      >
        {children}
        {!chat ? advertising : null}
      </main>
      {!chat ? <SiteFooter /> : null}
    </div>
  )
}
