"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import {
  BoxesIcon,
  ExternalLinkIcon,
  HouseIcon,
  LayoutDashboardIcon,
  MessageCircleIcon,
  MessageSquareTextIcon,
  PackageIcon,
  PlusIcon,
  ReceiptTextIcon,
  SettingsIcon,
  StoreIcon,
  TicketPercentIcon,
  UserRoundIcon,
} from "lucide-react"

import { useRealtime } from "@/components/realtime-provider"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageHeading } from "@/components/ui/page-heading"
import { Separator } from "@/components/ui/separator"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { apiAssetUrl } from "@/config/env"
import { initials } from "@/lib/format"
import { NotificationMenu } from "@/modules/notifications/components/notification-menu"
import {
  managementHref,
  managementSections,
  type ManagementTab,
} from "@/modules/shop-management/lib/management-navigation"
import type { ShopManagementUser } from "@/types/shop"

const sectionIcons = {
  overview: LayoutDashboardIcon,
  orders: ReceiptTextIcon,
  products: PackageIcon,
  inventory: BoxesIcon,
  promotions: TicketPercentIcon,
  reviews: MessageSquareTextIcon,
  settings: SettingsIcon,
}

function ManagementNavigation({
  activeTab,
  openOrders,
  unansweredReviews,
}: {
  activeTab: ManagementTab
  openOrders: number
  unansweredReviews: number
}) {
  const { setOpenMobile } = useSidebar()

  return (
    <SidebarContent role="navigation" aria-label="Quản lý cửa hàng">
      {[
        {
          label: "Quản lý kinh doanh",
          sections: managementSections.slice(0, 4),
        },
        { label: "Phát triển cửa hàng", sections: managementSections.slice(4) },
      ].map((group) => (
        <SidebarGroup key={group.label}>
          <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
          <SidebarMenu aria-label={group.label}>
            {group.sections.map((section) => {
              const Icon = sectionIcons[section.value]
              const count =
                section.value === "orders"
                  ? openOrders
                  : section.value === "reviews"
                    ? unansweredReviews
                    : 0

              return (
                <SidebarMenuItem key={section.value}>
                  <SidebarMenuButton
                    isActive={activeTab === section.value}
                    aria-current={
                      activeTab === section.value ? "page" : undefined
                    }
                    tooltip={section.label}
                    render={
                      <Link
                        href={managementHref(section.value)}
                        onNavigate={() => setOpenMobile(false)}
                      />
                    }
                  >
                    <Icon aria-hidden="true" />
                    <span>{section.label}</span>
                  </SidebarMenuButton>
                  {count > 0 ? (
                    <SidebarMenuBadge>{count}</SidebarMenuBadge>
                  ) : null}
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>
      ))}
    </SidebarContent>
  )
}

export function ShopManagementWorkspace({
  user,
  activeTab,
  openOrders,
  unansweredReviews,
  onCreateProduct,
  children,
}: {
  user: ShopManagementUser
  activeTab: ManagementTab
  openOrders: number
  unansweredReviews: number
  onCreateProduct: () => void
  children: ReactNode
}) {
  const { unreadCounts } = useRealtime()
  const section = managementSections.find((item) => item.value === activeTab)!
  const shopName = user.shop_name || "Cửa hàng của bạn"

  return (
    <SidebarProvider>
      <Sidebar
        collapsible="icon"
        variant="inset"
        aria-label="Điều hướng kênh người bán"
      >
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                tooltip="Kênh người bán · Deal Hay"
                render={<Link href="/shop-manage" />}
              >
                <StoreIcon aria-hidden="true" />
                <span className="grid gap-0.5">
                  <span className="font-semibold">Deal Hay</span>
                  <span className="text-xs text-muted-foreground">
                    Kênh người bán
                  </span>
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarSeparator />
        <ManagementNavigation
          activeTab={activeTab}
          openOrders={openOrders}
          unansweredReviews={unansweredReviews}
        />
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Xem cửa hàng (tab mới)"
                render={
                  <Link
                    href={`/shops/${user.user_code}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                }
              >
                <ExternalLinkIcon aria-hidden="true" />
                <span>Xem cửa hàng</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Trang mua sắm (tab mới)"
                render={
                  <Link href="/" target="_blank" rel="noopener noreferrer" />
                }
              >
                <HouseIcon aria-hidden="true" />
                <span>Trang mua sắm</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <SidebarSeparator />
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                tooltip="Hồ sơ tài khoản (tab mới)"
                render={
                  <Link
                    href="/profile"

                    target="_blank"
                    rel="noopener noreferrer"
                  />
                }
              >
                <UserRoundIcon
                  className="group-data-[state=expanded]:hidden"
                  aria-hidden="true"
                />
                <Avatar className="group-data-[collapsible=icon]:hidden">
                  <AvatarImage
                    src={apiAssetUrl(user.shop_avatar_url || user.avatar_url)}
                    alt={shopName}
                  />
                  <AvatarFallback>{initials(shopName)}</AvatarFallback>
                </Avatar>
                <span className="grid min-w-0 gap-0.5">
                  <span className="truncate font-medium">{shopName}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {user.full_name}
                  </span>
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b bg-background px-4 md:px-6">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {shopName}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              nativeButton={false}
              aria-label={`Tin nhắn${unreadCounts.messages > 0 ? `, ${unreadCounts.messages} chưa đọc` : ""} (mở tab mới)`}
              tooltip="Tin nhắn (mở tab mới)"
              render={
                <Link href="/chats" target="_blank" rel="noopener noreferrer" />
              }
            >
              <MessageCircleIcon aria-hidden="true" />
              <span className="hidden lg:inline">Tin nhắn</span>
              {unreadCounts.messages > 0 ? (
                <Badge variant="secondary">{unreadCounts.messages}</Badge>
              ) : null}
            </Button>
            <NotificationMenu compact />
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 p-4 md:p-6 lg:p-8">
          <PageHeading
            title={section.label}
            description={section.description}
            actions={
              <Button onClick={onCreateProduct}>
                <PlusIcon aria-hidden="true" /> Đăng sản phẩm
              </Button>
            }
          />
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
