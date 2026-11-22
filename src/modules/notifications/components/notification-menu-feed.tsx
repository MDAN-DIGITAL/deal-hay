"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { CheckCheckIcon } from "lucide-react"
import { toast } from "sonner"

import { getNotifications } from "@/api/notifications/queries"
import {
  markAllNotificationsRead,
  markVisibleNotificationsRead,
} from "@/api/notifications/mutations"
import { useRealtime } from "@/components/realtime-provider"
import { Button } from "@/components/ui/button"
import { PopoverHeader, PopoverTitle } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { getSessionId } from "@/lib/session"
import { NotificationItem } from "@/modules/notifications/components/notification-item"
import { useVisibleNotifications } from "@/modules/notifications/hooks/use-visible-notifications"
import type { AppNotification } from "@/types/notification"

function mergeItems(
  first: AppNotification[],
  second: AppNotification[],
  readTimes: ReadonlyMap<string, string>
) {
  const merged = new Map<string, AppNotification>()
  for (const item of [...first, ...second]) {
    const known = merged.get(item.id)
    merged.set(item.id, {
      ...(known ?? item),
      read_at: known?.read_at ?? item.read_at ?? readTimes.get(item.id) ?? null,
    })
  }
  return [...merged.values()].sort(
    (a, b) =>
      (Date.parse(b.created_at ?? "") || 0) -
      (Date.parse(a.created_at ?? "") || 0)
  )
}

export function NotificationMenuFeed({
  open,
  userId,
  onNavigate,
}: {
  open: boolean
  userId: string
  onNavigate: () => void
}) {
  const { echo, unreadCounts, synchronizeUnreadCounts } = useRealtime()
  const [items, setItems] = useState<AppNotification[]>([])
  const [page, setPage] = useState({ current: 0, last: 1 })
  const [failedPage, setFailedPage] = useState<number | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const listRef = useRef<HTMLDivElement>(null)
  const request = useRef<AbortController | null>(null)
  const refreshQueued = useRef(false)
  const active = useRef(false)
  const pendingReads = useRef(new Set<string>())
  const readTimes = useRef(new Map<string, string>())

  const loadPage = useCallback(async function loadPage(number: number) {
    if (request.current) {
      if (number === 1) refreshQueued.current = true
      return
    }
    const controller = new AbortController()
    request.current = controller
    try {
      const { notification_page } = await getNotifications(
        number,
        controller.signal
      )
      if (controller.signal.aborted) return
      const alreadyRead = new Map(readTimes.current)
      setItems((previous) =>
        mergeItems(previous, notification_page.data, alreadyRead)
      )
      setPage((previous) => ({
        current: Math.max(
          previous.current,
          notification_page.current_page ?? number
        ),
        last: notification_page.last_page ?? number,
      }))
      setFailedPage(null)
    } catch {
      if (!controller.signal.aborted) setFailedPage(number)
    } finally {
      if (request.current === controller) request.current = null
      if (!controller.signal.aborted) {
        setLoadingMore(false)
        if (refreshQueued.current) {
          refreshQueued.current = false
          void loadPage(1)
        }
      }
    }
  }, [])

  useEffect(() => {
    active.current = true
    void loadPage(1)
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => {
      active.current = false
      request.current?.abort()
      request.current = null
      refreshQueued.current = false
      window.clearInterval(timer)
    }
  }, [loadPage])

  const applyRead = useCallback((ids: string[], readAt: string) => {
    for (const id of ids) readTimes.current.set(id, readAt)
    const updated = new Set(ids)
    setItems((previous) =>
      previous.map((item) =>
        updated.has(item.id) && !item.read_at
          ? { ...item, read_at: readAt }
          : item
      )
    )
  }, [])

  useEffect(() => {
    if (!echo) return
    const channel = echo.private(`user-notifications.${userId}`)
    const onNotification = (payload: Partial<AppNotification> | null) => {
      if (
        typeof payload?.id !== "string" ||
        typeof payload.title !== "string" ||
        typeof payload.body !== "string"
      )
        return
      const read = new Map(readTimes.current)
      setItems((previous) =>
        mergeItems(previous, [payload as AppNotification], read)
      )
    }
    const onRead = (
      payload: { notification_ids?: string[]; read_at?: string } | null
    ) => {
      if (
        Array.isArray(payload?.notification_ids) &&
        typeof payload.read_at === "string"
      ) {
        applyRead(payload.notification_ids, payload.read_at)
      }
    }
    const onSubscribed = () => void loadPage(1)
    channel.listen(".notification.created", onNotification)
    channel.listen(".notifications.read", onRead)
    channel.listen(".pusher:subscription_succeeded", onSubscribed)
    return () => {
      channel.stopListening(".notification.created", onNotification)
      channel.stopListening(".notifications.read", onRead)
      channel.stopListening(".pusher:subscription_succeeded", onSubscribed)
    }
  }, [applyRead, echo, loadPage, userId])

  const readVisible = useCallback(
    async (ids: string[]) => {
      const needed = ids.filter(
        (id) => !pendingReads.current.has(id) && !readTimes.current.has(id)
      )
      if (needed.length === 0) return
      const session = getSessionId()
      needed.forEach((id) => pendingReads.current.add(id))
      try {
        for (
          let index = 0;
          index < needed.length && active.current;
          index += 50
        ) {
          const batch = needed.slice(index, index + 50)
          await markVisibleNotificationsRead(batch)
          if (active.current) applyRead(batch, new Date().toISOString())
        }
        if (getSessionId() === session) void synchronizeUnreadCounts()
      } finally {
        needed.forEach((id) => pendingReads.current.delete(id))
      }
    },
    [applyRead, synchronizeUnreadCounts]
  )

  useVisibleNotifications(
    listRef,
    open ? items.filter((item) => !item.read_at).map((item) => item.id) : [],
    readVisible
  )

  const markAll = async () => {
    if (markingAll) return
    const session = getSessionId()
    const ids = items.filter((item) => !item.read_at).map((item) => item.id)
    setMarkingAll(true)
    try {
      await markAllNotificationsRead()
      if (active.current) applyRead(ids, new Date().toISOString())
      if (getSessionId() === session) void synchronizeUnreadCounts()
    } catch {
      if (active.current) toast.error("Chưa thể đánh dấu thông báo đã đọc.")
    } finally {
      if (active.current) setMarkingAll(false)
    }
  }

  const requestPage = (next: number) => {
    if (request.current) return
    setLoadingMore(true)
    void loadPage(next)
  }

  return (
    <>
      <PopoverHeader className="min-h-9 shrink-0 flex-row items-center justify-between gap-2">
        <PopoverTitle>Thông báo</PopoverTitle>
        {unreadCounts.notifications > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            startIcon={<CheckCheckIcon />}
            disabled={markingAll}
            onClick={() => void markAll()}
          >
            Đọc tất cả
          </Button>
        ) : null}
      </PopoverHeader>
      {items.length > 0 ? (
        <ScrollArea className="flex min-h-8 flex-col *:data-[slot=scroll-area-viewport]:max-h-[min(30rem,55dvh)] *:data-[slot=scroll-area-viewport]:overscroll-contain">
          <div ref={listRef} className="pe-4">
            <ul className="divide-y divide-border">
              {items.map((item) => (
                <NotificationItem
                  key={item.id}
                  notification={item}
                  now={now}
                  origin={window.location.origin}
                  onOpen={() => {
                    if (!item.read_at)
                      void readVisible([item.id]).catch(() => {})
                    onNavigate()
                  }}
                />
              ))}
            </ul>
          </div>
        </ScrollArea>
      ) : page.current === 0 && failedPage === null ? (
        <div role="status" aria-busy="true" className="space-y-3">
          <span className="sr-only">Đang tải thông báo</span>
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : failedPage === null ? (
        <p className="py-6 text-center text-muted-foreground">
          Bạn chưa có thông báo.
        </p>
      ) : null}
      {failedPage !== null ? (
        <div
          className="flex shrink-0 items-center justify-between gap-2"
          role="status"
        >
          <p className="text-muted-foreground">Không thể tải thông báo.</p>
          <Button
            variant="outline"
            size="sm"
            disabled={loadingMore}
            onClick={() => requestPage(failedPage)}
          >
            Thử lại
          </Button>
        </div>
      ) : page.current > 0 && page.current < page.last ? (
        <Button
          variant="ghost"
          size="sm"
          disabled={loadingMore}
          onClick={() => requestPage(page.current + 1)}
        >
          {loadingMore ? "Đang tải…" : "Xem thêm"}
        </Button>
      ) : null}
    </>
  )
}
