"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { useEffect, useState } from "react"
import { BellIcon } from "lucide-react"

import { UnreadCountBadge } from "@/components/layout/unread-count-badge"
import { useRealtime } from "@/components/realtime-provider"
import { useSession } from "@/components/session-provider"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import { getAuthPageHref } from "@/lib/auth-redirect"
import {
  notificationMenuEvent,
  notificationMenuHref,
  notificationMenuQuery,
} from "@/modules/notifications/lib/notification-menu-navigation"

function NotificationMenuLoading() {
  return (
    <div aria-busy="true" role="status" className="space-y-3">
      <span className="sr-only">Đang tải thông báo</span>
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  )
}

const NotificationMenuFeed = dynamic(
  () =>
    import("./notification-menu-feed").then(
      ({ NotificationMenuFeed }) => NotificationMenuFeed
    ),
  {
    loading: () => (
      <>
        <PopoverHeader className="min-h-9 shrink-0 justify-center">
          <PopoverTitle>Thông báo</PopoverTitle>
        </PopoverHeader>
        <NotificationMenuLoading />
      </>
    ),
  }
)

export function NotificationMenu({ compact = false }: { compact?: boolean }) {
  const { user, loading } = useSession()
  const { unreadCounts } = useRealtime()
  const unread = unreadCounts.notifications
  const [open, setOpen] = useState(false)
  const label = unread > 0 ? `Thông báo, ${unread} chưa đọc` : "Thông báo"

  useEffect(() => {
    const openMenu = (event: Event) => {
      event.preventDefault()
      setOpen(true)
    }
    window.addEventListener(notificationMenuEvent, openMenu)
    return () => window.removeEventListener(notificationMenuEvent, openMenu)
  }, [])

  useEffect(() => {
    if (loading) return
    const url = new URL(window.location.href)
    if (url.searchParams.get(notificationMenuQuery) !== "open") return
    const frame = window.requestAnimationFrame(() => {
      const current = new URL(window.location.href)
      if (current.searchParams.get(notificationMenuQuery) !== "open") return
      current.searchParams.delete(notificationMenuQuery)
      window.history.replaceState(window.history.state, "", current)
      setOpen(true)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [loading])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size={compact ? "icon-sm" : "default"}
            className={
              compact ? "relative" : "relative size-10 xl:w-auto xl:px-3"
            }
            aria-label={label}
            tooltip={label}
          />
        }
      >
        <BellIcon aria-hidden="true" />
        {compact ? null : <span className="hidden xl:inline">Thông báo</span>}
        <UnreadCountBadge
          count={unread}
          className={
            compact
              ? "absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px]"
              : "absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] xl:static xl:h-5"
          }
        />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        collisionAvoidance={{ side: "none", align: "shift" }}
        collisionPadding={12}
        className="max-h-[min(var(--available-height),calc(100dvh-4rem))] w-[min(26rem,calc(100dvw-1.5rem))] gap-2 overflow-y-auto overscroll-contain p-3"
      >
        {user && !loading ? (
          <NotificationMenuFeed
            key={user.id}
            open={open}
            userId={user.id}
            onNavigate={() => setOpen(false)}
          />
        ) : (
          <>
            <PopoverHeader className="min-h-9 shrink-0 justify-center">
              <PopoverTitle>Thông báo</PopoverTitle>
            </PopoverHeader>
            {loading ? (
              <NotificationMenuLoading />
            ) : (
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={
                  <Link
                    href={getAuthPageHref("/sign-in", notificationMenuHref)}
                  />
                }
                onClick={() => setOpen(false)}
              >
                Đăng nhập để xem thông báo
              </Button>
            )}
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
