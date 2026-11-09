"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ActivityIcon,
  BellIcon,
  HouseIcon,
  LayoutDashboardIcon,
  LogInIcon,
  MenuIcon,
  MessageCircleIcon,
  ShieldCheckIcon,
  StoreIcon,
  TicketPercentIcon,
  UserRoundIcon,
  UserPlusIcon,
} from "lucide-react"

import { ServerPing } from "@/components/layout/server-ping"
import { SignOutButton } from "@/components/layout/sign-out-button"
import { NotificationSoundToggle } from "@/components/layout/notification-sound-toggle"
import { UnreadCountBadge } from "@/components/layout/unread-count-badge"
import { useRealtime } from "@/components/realtime-provider"
import { Button, buttonVariants } from "@/components/ui/button"
import { Brand } from "@/components/ui/brand"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { UserAvatar } from "@/components/user-avatar"
import { ChatPageLink } from "@/components/chat-page-link"
import type { User } from "@/types/auth"

const publicItems = [
  { href: "/", label: "Khám phá sản phẩm", icon: HouseIcon },
  {
    href: "/chats",
    label: "Tin nhắn",
    icon: MessageCircleIcon,
    unreadKey: "messages",
  },
  {
    href: "/notifications",
    label: "Thông báo",
    icon: BellIcon,
    unreadKey: "notifications",
  },
  { href: "/profile", label: "Hồ sơ cá nhân", icon: UserRoundIcon },
] as const

export function MobileNavigation({
  user,
  sessionLoading = false,
}: {
  user: User | null
  sessionLoading?: boolean
}) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const { unreadCounts } = useRealtime()
  const active = (href: string) =>
    href === "/"
      ? pathname === "/"
      : href.startsWith("/admin/")
        ? pathname.startsWith("/admin/")
        : pathname === href || pathname.startsWith(`${href}/`)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={<Button aria-label="Mở menu" size="icon" variant="ghost" />}
      >
        <MenuIcon />
      </SheetTrigger>
      <SheetContent
        className="w-[min(88vw,360px)] gap-4 overflow-y-auto"
        side="right"
      >
        <SheetHeader className="border-b">
          <SheetTitle>
            <Brand />
          </SheetTitle>
          <SheetDescription>
            Điều hướng nhanh và tài khoản của bạn.
          </SheetDescription>
        </SheetHeader>

        {sessionLoading ? (
          <Card
            aria-busy="true"
            aria-label="Đang tải tài khoản"
            className="mx-4 shrink-0"
            size="sm"
          >
            <CardContent className="flex-row items-center gap-3">
              <span className="size-11 animate-pulse rounded-full bg-muted" />
              <span className="h-4 flex-1 animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        ) : user ? (
          <Card size="sm" className="mx-4 shrink-0">
            <CardContent className="flex-row items-center gap-3">
              <UserAvatar
                className="size-11"
                name={user.full_name}
                size="lg"
                src={user.avatar_url}
              />
              <div className="min-w-0">
                <p className="truncate font-medium">{user.full_name}</p>
                <ServerPing active={open} />
                <p className="truncate text-xs text-muted-foreground">
                  {user.email}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <nav
          className="flex flex-col gap-1 px-3"
          aria-label="Điều hướng di động"
        >
          {publicItems.map((item) => {
            const count = "unreadKey" in item ? unreadCounts[item.unreadKey] : 0
            const NavigationLink = item.href === "/chats" ? ChatPageLink : Link

            return (
              <NavigationLink
                onNavigate={() => setOpen(false)}
                onClick={
                  item.href === "/chats" ? () => setOpen(false) : undefined
                }
                href={item.href}
                aria-current={active(item.href) ? "page" : undefined}
                key={item.href}
                aria-label={
                  count > 0 ? `${item.label}, ${count} chưa đọc` : item.label
                }
                className={buttonVariants({
                  className: "justify-start",
                  variant: active(item.href) ? "secondary" : "ghost",
                })}
              >
                <item.icon /> {item.label}
                <UnreadCountBadge className="ml-auto" count={count} />
              </NavigationLink>
            )
          })}
          {user ? (
            <Link
              onNavigate={() => setOpen(false)}
              href="/discount-codes"
              aria-current={active("/discount-codes") ? "page" : undefined}
              className={buttonVariants({
                className: "justify-start",
                variant: active("/discount-codes") ? "secondary" : "ghost",
              })}
            >
              <TicketPercentIcon /> Mã giảm giá của tôi
            </Link>
          ) : null}
          {user?.role === "shop_owner" ? (
            <Link
              onNavigate={() => setOpen(false)}
              href="/shop-manage"
              aria-current={active("/shop-manage") ? "page" : undefined}
              className={buttonVariants({
                className: "justify-start",
                variant: active("/shop-manage") ? "secondary" : "ghost",
              })}
            >
              <StoreIcon /> Kênh người bán
            </Link>
          ) : null}
          {user?.role === "administrator" ? (
            <>
              <Link
                onNavigate={() => setOpen(false)}
                href="/diagnostics"
                aria-current={active("/diagnostics") ? "page" : undefined}
                className={buttonVariants({
                  className: "justify-start",
                  variant: active("/diagnostics") ? "secondary" : "ghost",
                })}
              >
                <ActivityIcon /> Đo tốc độ máy chủ
              </Link>
              <Link
                onNavigate={() => setOpen(false)}
                href="/admin/users"
                aria-current={active("/admin/users") ? "page" : undefined}
                className={buttonVariants({
                  className: "justify-start",
                  variant: active("/admin/users") ? "secondary" : "ghost",
                })}
              >
                <LayoutDashboardIcon /> Trung tâm quản trị
              </Link>
            </>
          ) : null}
        </nav>

        <div className="mt-auto space-y-3 border-t p-4">
          {user ? (
            <div className="flex items-center justify-between gap-2 text-sm">
              <span>Âm thanh tin nhắn và thông báo</span>
              <NotificationSoundToggle />
            </div>
          ) : null}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheckIcon className="size-4 text-primary" /> Giao dịch minh
            bạch và an toàn
          </div>
          <Separator />
          {sessionLoading ? (
            <div
              aria-busy="true"
              aria-label="Đang tải thao tác tài khoản"
              className="h-9 w-full animate-pulse rounded-md bg-muted"
            />
          ) : user ? (
            <SignOutButton className="w-full" />
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Link
                onNavigate={() => setOpen(false)}
                href="/sign-in"
                className={buttonVariants({ variant: "outline" })}
              >
                <LogInIcon aria-hidden="true" />
                Đăng nhập
              </Link>
              <Link
                onNavigate={() => setOpen(false)}
                href="/sign-up"
                className={buttonVariants()}
              >
                <UserPlusIcon aria-hidden="true" />
                Đăng ký
              </Link>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
