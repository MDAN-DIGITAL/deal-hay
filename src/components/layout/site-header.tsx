"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useRef, useState } from "react"
import {
  ActivityIcon,
  ChevronDownIcon,
  HouseIcon,
  LogInIcon,
  MessageCircleIcon,
  ShieldCheckIcon,
  ShoppingCartIcon,
  StoreIcon,
  TicketPercentIcon,
  UserPlusIcon,
  UserRoundIcon,
  Volume2Icon,
  type LucideIcon,
} from "lucide-react"

import { useSession } from "@/components/session-provider"
import { NotificationSoundDialog } from "@/components/layout/notification-sound-toggle"
import { ServerPing } from "@/components/layout/server-ping"
import { SignOutButton } from "@/components/layout/sign-out-button"
import { StorefrontSearch } from "@/components/layout/storefront-search"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { UnreadNavigationLink } from "@/components/layout/unread-count-badge"
import { Brand } from "@/components/ui/brand"
import { SITE_CONTAINER_CLASS_NAME } from "@/components/layout/site-container"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { UserAvatar } from "@/components/user-avatar"
import { cn } from "@/lib/utils"
import { NotificationMenu } from "@/modules/notifications/components/notification-menu"

type AccountLink = {
  href: string
  label: string
  icon: LucideIcon
  newTab?: boolean
}

const browseItems: AccountLink[] = [
  { href: "/", label: "Khám phá sản phẩm", icon: HouseIcon },
  { href: "/cart", label: "Giỏ hàng", icon: ShoppingCartIcon },
  { href: "/shops", label: "Cửa hàng", icon: StoreIcon },
]

const memberItems: AccountLink[] = [
  { href: "/profile", label: "Hồ sơ cá nhân", icon: UserRoundIcon },
  { href: "/discount-codes", label: "Mã giảm giá", icon: TicketPercentIcon },
]

const guestItems: AccountLink[] = [
  { href: "/sign-in", label: "Đăng nhập", icon: LogInIcon },
  { href: "/sign-up", label: "Tạo tài khoản", icon: UserPlusIcon },
]

const sellerItems: AccountLink[] = [
  {
    href: "/shop-manage",
    label: "Kênh người bán",
    icon: StoreIcon,
    newTab: true,
  },
]

const adminItems: AccountLink[] = [
  { href: "/admin", label: "Quản trị", icon: ShieldCheckIcon },
  { href: "/diagnostics", label: "Đo tốc độ máy chủ", icon: ActivityIcon },
]

export function SiteHeader({
  storefront = false,
}: { storefront?: boolean } = {}) {
  const { user, loading } = useSession()
  const pathname = usePathname()
  const accountTriggerRef = useRef<HTMLButtonElement>(null)
  const [accountOpen, setAccountOpen] = useState(false)
  const [soundSettingsOpen, setSoundSettingsOpen] = useState(false)
  const items = [
    ...browseItems,
    ...(user ? memberItems : guestItems),
    ...(user?.role === "shop_owner" ? sellerItems : []),
    ...(user?.role === "administrator" ? adminItems : []),
  ]

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-card/95 backdrop-blur supports-backdrop-filter:bg-card/90">
      <div
        className={cn(
          SITE_CONTAINER_CLASS_NAME,
          "items-center",
          storefront
            ? "grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] md:gap-x-6"
            : "flex h-16 gap-4"
        )}
      >
        <Link href="/" aria-label="Deal Hay - Trang chủ">
          <Brand compact />
        </Link>

        {storefront ? (
          <div className="col-span-2 row-start-2 min-w-0 pb-3 sm:col-span-1 sm:col-start-2 sm:row-start-1 sm:pb-0">
            <StorefrontSearch />
          </div>
        ) : null}

        <div
          className={cn(
            "ml-auto flex items-center gap-0.5 xl:gap-1",
            storefront && "col-start-2 row-start-1 h-16 sm:col-start-3"
          )}
        >
          <UnreadNavigationLink
            badgeClassName="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px]"
            className="relative"
            href="/chats"
            kind="messages"
            label="Mở tin nhắn"
            size="icon"
          >
            <MessageCircleIcon aria-hidden="true" />
          </UnreadNavigationLink>
          <NotificationMenu compact />
          <ThemeToggle />

          {loading ? (
            <div
              aria-busy="true"
              aria-label="Đang tải tài khoản"
              className="flex size-10 shrink-0 items-center justify-center"
            >
              <span className="size-7 animate-pulse rounded-full bg-muted" />
            </div>
          ) : (
            <DropdownMenu onOpenChange={setAccountOpen}>
              <DropdownMenuTrigger
                render={
                  <Button
                    ref={accountTriggerRef}
                    aria-label="Mở menu tài khoản"
                    className="px-1.5 xl:px-3"
                    variant="ghost"
                  />
                }
              >
                {user ? (
                  <>
                    <UserAvatar
                      className="size-7"
                      name={user.full_name}
                      size="sm"
                      src={user.avatar_url}
                    />
                    <span className="hidden max-w-32 truncate xl:block">
                      {user.full_name}
                    </span>
                    <ChevronDownIcon
                      aria-hidden="true"
                      className="hidden size-3.5 text-muted-foreground xl:block"
                    />
                  </>
                ) : (
                  <UserRoundIcon aria-hidden="true" className="size-5" />
                )}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuGroup>
                  {user ? (
                    <>
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
                    </>
                  ) : null}
                  {items.map(({ href, icon: Icon, label, newTab }) => (
                    <DropdownMenuItem
                      key={href}
                      render={
                        <Link
                          href={href}
                          aria-current={
                            pathname === href ||
                            (href !== "/" && pathname.startsWith(`${href}/`))
                              ? "page"
                              : undefined
                          }
                          target={newTab ? "_blank" : undefined}
                          rel={newTab ? "noopener noreferrer" : undefined}
                          title={
                            newTab ? `${label} (mở trong tab mới)` : undefined
                          }
                        />
                      }
                    >
                      <Icon aria-hidden="true" /> {label}
                    </DropdownMenuItem>
                  ))}
                  {user ? (
                    <DropdownMenuItem
                      onClick={() => setSoundSettingsOpen(true)}
                    >
                      <Volume2Icon aria-hidden="true" /> Âm thanh và thông báo
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuGroup>
                {user ? (
                  <>
                    <DropdownMenuSeparator />
                    <SignOutButton inMenu />
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {user ? (
        <NotificationSoundDialog
          open={soundSettingsOpen}
          onOpenChange={setSoundSettingsOpen}
          finalFocus={accountTriggerRef}
        />
      ) : null}
    </header>
  )
}
