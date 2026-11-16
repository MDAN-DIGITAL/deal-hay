"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ActivityIcon,
  FolderTreeIcon,
  LayoutDashboardIcon,
  StoreIcon,
  TicketCheckIcon,
  UsersIcon,
} from "lucide-react"
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { openAuthenticatedTab } from "@/lib/authenticated-tab"
import {
  adminSections,
  adminSection,
} from "@/modules/admin/lib/admin-navigation"

const icons = {
  overview: LayoutDashboardIcon,
  users: UsersIcon,
  shops: StoreIcon,
  categories: FolderTreeIcon,
  tickets: TicketCheckIcon,
}

export function AdminNavigation() {
  const pathname = usePathname()
  const current = adminSection(pathname)
  const { setOpenMobile } = useSidebar()
  return (
    <SidebarContent role="navigation" aria-label="Quản lý hệ thống">
      <SidebarGroup>
        <SidebarGroupLabel>Quản lý hệ thống</SidebarGroupLabel>
        <SidebarMenu>
          {adminSections.map((section) => {
            const Icon = icons[section.icon]
            return (
              <SidebarMenuItem key={section.href}>
                <SidebarMenuButton
                  isActive={current.href === section.href}
                  aria-current={
                    current.href === section.href ? "page" : undefined
                  }
                  tooltip={section.label}
                  render={
                    <Link
                      href={section.href}
                      onNavigate={() => setOpenMobile(false)}
                    />
                  }
                >
                  <Icon aria-hidden="true" />
                  <span>{section.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroup>
      <SidebarGroup>
        <SidebarGroupLabel>Vận hành</SidebarGroupLabel>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Chẩn đoán hệ thống (tab mới)"
              render={
                <Link
                  href="/diagnostics"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={openAuthenticatedTab}
                  onAuxClick={openAuthenticatedTab}
                />
              }
            >
              <ActivityIcon aria-hidden="true" />
              <span>Chẩn đoán hệ thống</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>
    </SidebarContent>
  )
}
