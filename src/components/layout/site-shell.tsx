"use client"

import { usePathname } from "next/navigation"
import { SITE_CONTAINER_CLASS_NAME } from "@/components/layout/site-container"
import { SiteHeader } from "@/components/layout/site-header"
import { SiteFooter } from "@/components/layout/site-footer"
import { cn } from "@/lib/utils"

export function SiteShell({
  children,
  storefront,
}: {
  children: React.ReactNode
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
                SITE_CONTAINER_CLASS_NAME,
                "flex-1",
                storefront ? "py-4 sm:py-6" : "py-6 sm:py-8"
              )
        }
      >
        {children}
      </main>
      {!chat ? <SiteFooter /> : null}
    </div>
  )
}
