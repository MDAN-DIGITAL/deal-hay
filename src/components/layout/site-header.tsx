"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { BellIcon, ChevronDownIcon, MessageCircleIcon } from "lucide-react"

import { useSession } from "@/components/session-provider"
import { ServerPing } from "@/components/layout/server-ping"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Button, buttonVariants } from "@/components/ui/button"
import { Brand } from "@/components/ui/brand"
import { MobileNavigation } from "@/components/layout/mobile-navigation"
import { NotificationSoundToggle } from "@/components/layout/notification-sound-toggle"
import { SignOutButton } from "@/components/layout/sign-out-button"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import {
  UnreadCountBadge,
  UnreadNavigationLink,
} from "@/components/layout/unread-count-badge"
import { UserAvatar } from "@/components/user-avatar"
import { ChatPageLink } from "@/components/chat-page-link"

type NavigationItem = {
  href: string
  label: string
  unreadKey?: "messages" | "notifications"
}

const navigation: NavigationItem[] = [
  { href: "/", label: "Khám phá" },
  { href: "/chats", label: "Tin nhắn", unreadKey: "messages" },
  { href: "/notifications", label: "Thông báo", unreadKey: "notifications" },
]

export function SiteHeader() {
  const { user, loading } = useSession()
  const pathname = usePathname()
  const [accountOpen, setAccountOpen] = useState(false)
  const items: NavigationItem[] = [
    ...navigation,
    ...(user ? [{ href: "/discount-codes", label: "Mã giảm giá" }] : []),
    ...(user?.role === "shop_owner"
      ? [{ href: "/shop-manage", label: "Kênh người bán" }]
      : []),
    ...(user?.role === "administrator"
      ? [{ href: "/admin/users", label: "Quản trị" }]
      : []),
  ]
  const active = (href: string) =>
    href === "/"
      ? pathname === "/"
      : href.startsWith("/admin/")
        ? pathname.startsWith("/admin/")
        : pathname === href || pathname.startsWith(`${href}/`)

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-card/95 backdrop-blur supports-backdrop-filter:bg-card/90">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="Deal Hay - Trang chủ">
          <Brand compact />
        </Link>

        <nav
          className="ml-3 hidden items-center gap-1 xl:flex"
          aria-label="Điều hướng chính"
        >
          {items.map((item) => {
            const NavigationLink = item.href === "/chats" ? ChatPageLink : Link
            return (
              <NavigationLink
                key={item.href}
                href={item.href}
                aria-current={active(item.href) ? "page" : undefined}
                className={buttonVariants({
                  variant: active(item.href) ? "secondary" : "ghost",
                })}
              >
                {item.label}
                {item.unreadKey ? (
                  <UnreadCountBadge kind={item.unreadKey} />
                ) : null}
              </NavigationLink>
            )
          })}
        </nav>

        <div className="ml-auto hidden items-center gap-1 xl:flex">
          <ThemeToggle />
          {loading ? (
            <div
              aria-busy="true"
              aria-label="Đang tải tài khoản"
              className="flex h-9 items-center gap-2 px-3"
            >
              <span className="size-7 animate-pulse rounded-full bg-muted" />
              <span className="h-4 w-24 animate-pulse rounded bg-muted" />
            </div>
          ) : user ? (
            <>
              <NotificationSoundToggle />
              <DropdownMenu onOpenChange={setAccountOpen}>
                <DropdownMenuTrigger
                  render={
                    <Button aria-label="Mở menu tài khoản" variant="ghost" />
                  }
                >
                  <UserAvatar
                    className="size-7"
                    name={user.full_name}
                    size="sm"
                    src={user.avatar_url}
                  />
                  <span className="max-w-32 truncate">{user.full_name}</span>
                  <ChevronDownIcon className="size-3.5 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="space-y-1 text-sm">
                      <span className="block truncate font-medium text-foreground">
                        {user.full_name}
                      </span>
                      <span className="block truncate text-xs font-normal">
                        {user.email}
                      </span>
                      <ServerPing active={accountOpen} />
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem render={<Link href="/profile" />}>
                      Hồ sơ cá nhân
                    </DropdownMenuItem>
                    {user.role === "administrator" ? (
                      <DropdownMenuItem render={<Link href="/diagnostics" />}>
                        Đo tốc độ máy chủ
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <div className="p-1">
                    <SignOutButton className="w-full justify-start" />
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Link
                href="/sign-in"
                className={buttonVariants({ variant: "ghost" })}
              >
                Đăng nhập
              </Link>
              <Link href="/sign-up" className={buttonVariants()}>
                Tạo tài khoản
              </Link>
            </>
          )}
        </div>

        <div className="ml-auto flex items-center gap-0.5 xl:hidden">
          <UnreadNavigationLink
            badgeClassName="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px]"
            className="relative"
            href="/chats"
            kind="messages"
            label="Mở tin nhắn"
            size="icon"
          >
            <MessageCircleIcon />
          </UnreadNavigationLink>
          <UnreadNavigationLink
            badgeClassName="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px]"
            className="relative"
            href="/notifications"
            kind="notifications"
            label="Mở thông báo"
            size="icon"
          >
            <BellIcon />
          </UnreadNavigationLink>
          <ThemeToggle />
          <MobileNavigation sessionLoading={loading} user={user} />
        </div>
      </div>
    </header>
  )
}
