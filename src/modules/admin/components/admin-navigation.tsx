"use client"

import Link from "next/link"
import {
  FolderTreeIcon,
  StoreIcon,
  TicketCheckIcon,
  UsersIcon,
} from "lucide-react"
import { usePathname } from "next/navigation"

import { buttonVariants } from "@/components/ui/button"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Surface } from "@/components/ui/surface"

const items = [
  { href: "/admin/users", label: "Người dùng", icon: UsersIcon },
  { href: "/admin/shops", label: "Cửa hàng", icon: StoreIcon },
  { href: "/admin/categories", label: "Danh mục", icon: FolderTreeIcon },
  { href: "/admin/tickets", label: "Yêu cầu hỗ trợ", icon: TicketCheckIcon },
]

export function AdminNavigation() {
  const pathname = usePathname()

  return (
    <ScrollArea className="w-full">
      <Surface
        render={<nav aria-label="Điều hướng quản trị" />}
        padding="none"
        variant="muted"
        className="flex w-max gap-1 p-1"
      >
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={pathname.startsWith(item.href) ? "page" : undefined}
            className={buttonVariants({
              variant: pathname.startsWith(item.href) ? "secondary" : "ghost",
            })}
          >
            <item.icon /> {item.label}
          </Link>
        ))}
      </Surface>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  )
}
