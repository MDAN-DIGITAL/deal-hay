"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BellIcon,
  HouseIcon,
  MessageCircleIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
} from "lucide-react"
import { AuthGuard } from "@/components/session-provider"
import { useRealtime } from "@/components/realtime-provider"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { SignOutButton } from "@/components/layout/sign-out-button"
import { UserAvatar } from "@/components/user-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageHeading } from "@/components/ui/page-heading"
import { Separator } from "@/components/ui/separator"
import {
  Sidebar,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { openAuthenticatedTab } from "@/lib/authenticated-tab"
import { invalidateQueries } from "@/lib/query-cache"
import { AdminNavigation } from "@/modules/admin/components/admin-navigation"
import { adminSection } from "@/modules/admin/lib/admin-navigation"

export function AdminWorkspace({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const section = adminSection(pathname)
  const { unreadCounts } = useRealtime()

  return (
    <AuthGuard admin>
      {(user) => (
        <SidebarProvider>
          <Sidebar
            collapsible="icon"
            variant="inset"
            aria-label="Điều hướng quản trị"
          >
            <SidebarHeader>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    size="lg"
                    tooltip="Quản trị · Deal Hay"
                    render={<Link href="/admin" />}
                  >
                    <ShieldCheckIcon aria-hidden="true" />
                    <span className="grid gap-0.5">
                      <span className="font-semibold">Deal Hay</span>
                      <span className="text-xs text-muted-foreground">
                        Kênh quản trị
                      </span>
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarHeader>
            <SidebarSeparator />
            <AdminNavigation />
            <SidebarFooter>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip="Trang mua sắm (tab mới)"
                    render={
                      <Link
                        href="/"
                        target="_blank"
                        rel="noopener noreferrer"
                      />
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
                        onClick={openAuthenticatedTab}
                        onAuxClick={openAuthenticatedTab}
                      />
                    }
                  >
                    <UserAvatar name={user.full_name} src={user.avatar_url} />
                    <span className="grid min-w-0 gap-0.5">
                      <span className="truncate font-medium">
                        {user.full_name}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        Quản trị viên
                      </span>
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
              <SignOutButton className="w-full group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:text-[0px]" />
            </SidebarFooter>
            <SidebarRail />
          </Sidebar>
          <SidebarInset className="min-w-0">
            <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b bg-background px-4 md:px-6">
              <SidebarTrigger />
              <Separator orientation="vertical" className="h-4" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                Quản trị hệ thống
              </span>
              <div className="flex items-center gap-1">
                {[
                  {
                    href: "/chats",
                    label: "Tin nhắn",
                    icon: MessageCircleIcon,
                    count: unreadCounts.messages,
                  },
                  {
                    href: "/notifications",
                    label: "Thông báo",
                    icon: BellIcon,
                    count: unreadCounts.notifications,
                  },
                ].map((item) => (
                  <Button
                    key={item.href}
                    variant="ghost"
                    size="sm"
                    nativeButton={false}
                    aria-label={`${item.label}${item.count > 0 ? `, ${item.count} chưa đọc` : ""} (mở tab mới)`}
                    tooltip={`${item.label} (mở tab mới)`}
                    render={
                      <Link
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={openAuthenticatedTab}
                        onAuxClick={openAuthenticatedTab}
                      />
                    }
                  >
                    <item.icon aria-hidden="true" />
                    <span className="hidden lg:inline">{item.label}</span>
                    {item.count > 0 ? (
                      <Badge variant="secondary">{item.count}</Badge>
                    ) : null}
                  </Button>
                ))}
                <ThemeToggle />
              </div>
            </header>
            <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 p-4 md:p-6 lg:p-8">
              <PageHeading
                title={section.label}
                description={section.description}
                actions={
                  <Button variant="outline" onClick={invalidateQueries}>
                    <RefreshCwIcon aria-hidden="true" />
                    Làm mới
                  </Button>
                }
              />
              {children}
            </div>
          </SidebarInset>
        </SidebarProvider>
      )}
    </AuthGuard>
  )
}
