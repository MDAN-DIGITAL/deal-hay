"use client"

import { usePathname } from "next/navigation"
import { SiteHeader } from "@/components/layout/site-header"
import { SiteFooter } from "@/components/layout/site-footer"

export function SiteShell({
  children,
  advertising,
}: {
  children: React.ReactNode
  advertising?: React.ReactNode
}) {
  const pathname = usePathname()
  const chat = pathname === "/chats" || pathname.startsWith("/chats/")
  return (
    <div className="flex min-h-svh flex-col">
      {!chat ? <SiteHeader /> : null}
      <main
        className={
          chat
            ? "chat-surface h-dvh min-h-0 w-full overflow-hidden bg-background text-foreground"
            : "mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10"
        }
      >
        {children}
        {!chat ? advertising : null}
      </main>
      {!chat ? <SiteFooter /> : null}
    </div>
  )
}
