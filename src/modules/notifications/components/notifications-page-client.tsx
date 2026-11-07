"use client"

import { Surface } from "@/components/ui/surface"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { FormSubmitButton } from "@/components/form-submit-button"
import { DataPagination } from "@/components/layout/data-pagination"
import { EmptyState } from "@/components/layout/empty-state"
import { PageHeader } from "@/components/layout/page-header"
import { useRealtime } from "@/components/realtime-provider"
import { buttonVariants } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Textarea } from "@/components/ui/textarea"
import { applyServerErrors } from "@/lib/form-utils"
import type { PaginatedResponse } from "@/types/common"
import type { AppNotification } from "@/types/notification"
import { liveApiFetch } from "@/api/live-client"
import { NotificationItem } from "@/modules/notifications/components/notification-item"
import { useVisibleNotifications } from "@/modules/notifications/hooks/use-visible-notifications"
import { notificationAppealAction } from "@/modules/notifications/actions"
import {
  notificationAppealSchema,
  type NotificationAppealValues,
} from "@/modules/notifications/schemas/notifications"

function NotificationAppealForm({
  notificationId,
}: {
  notificationId: string
}) {
  const [isPending, startTransition] = useTransition()
  const form = useForm<NotificationAppealValues>({
    resolver: zodResolver(notificationAppealSchema),
    defaultValues: {
      notification_id: notificationId,
      message: "",
    },
  })

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const state = await notificationAppealAction(values)
      const hasFieldErrors = applyServerErrors(state.errors, form.setError)

      if (state.success) {
        toast.success(state.message)
        form.reset({ notification_id: notificationId, message: "" })
        return
      }

      if (!hasFieldErrors && state.message) {
        toast.error(state.message)
      }
    })
  })

  return (
    <Form {...form}>
      <form className="space-y-3" noValidate onSubmit={onSubmit}>
        <FormField
          control={form.control}
          name="message"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Khiếu nại thông báo này</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Mô tả lý do cần admin hỗ trợ..."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormSubmitButton
          idleText="Gửi khiếu nại"
          pending={isPending}
          pendingText="Đang gửi..."
          variant="outline"
        />
      </form>
    </Form>
  )
}

export function NotificationsPageClient({
  page,
  currentUserId,
}: {
  page: PaginatedResponse<AppNotification>
  currentUserId?: string
}) {
  const origin =
    typeof window === "undefined" ? "https://dealhay.vn" : window.location.origin
  const [notificationPage, setNotificationPage] = useState(page)
  const [newNotificationCount, setNewNotificationCount] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const notificationRevision = useRef(0)
  const knownNotificationIds = useRef(new Set(page.data.map(({ id }) => id)))
  const { echo, synchronizeUnreadCounts } = useRealtime()
  const containerRef = useRef<HTMLDivElement>(null)
  const pendingReads = useRef(new Set<string>())
  const applyRead = useCallback(
    (ids: string[], readAt: string) => {
      notificationRevision.current += 1
      const readIds = new Set(ids)
      setNotificationPage((previous) => ({
        ...previous,
        data: previous.data.map((notification) =>
          readIds.has(notification.id)
            ? { ...notification, read_at: notification.read_at ?? readAt }
            : notification
        ),
      }))
      void synchronizeUnreadCounts()
    },
    [synchronizeUnreadCounts]
  )
  const readVisible = useCallback(
    async (ids: string[]) => {
      const unread = ids.filter((id) => !pendingReads.current.has(id))
      if (!unread.length) return
      unread.forEach((id) => pendingReads.current.add(id))
      try {
        await liveApiFetch("/notifications/read-visible", {
          method: "PATCH",
          body: { notification_ids: unread },
        })
        applyRead(unread, new Date().toISOString())
      } finally {
        unread.forEach((id) => pendingReads.current.delete(id))
      }
    },
    [applyRead]
  )
  useVisibleNotifications(
    containerRef,
    notificationPage.data.filter(({ read_at }) => !read_at).map(({ id }) => id),
    readVisible
  )
  const currentPage = page.current_page ?? 1
  const pageSize =
    "per_page" in page && typeof page.per_page === "number" && page.per_page > 0
      ? page.per_page
      : 20

  useEffect(() => {
    const update = () => setNow(Date.now())
    const interval = window.setInterval(update, 60_000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!echo || !currentUserId) return

    let disposed = false
    let synchronizing = false
    let synchronizationRequested = false
    const channel = echo.private(`user-notifications.${currentUserId}`)

    const synchronize = async () => {
      synchronizationRequested = true
      if (synchronizing) return
      synchronizing = true

      try {
        while (synchronizationRequested && !disposed) {
          synchronizationRequested = false
          const revision = notificationRevision.current
          const response = await liveApiFetch<{
            notification_page: PaginatedResponse<AppNotification>
          }>("/notifications", { searchParams: { page: currentPage } })
          const updatedPage = response.notification_page
          if (disposed) return
          if (revision !== notificationRevision.current) {
            synchronizationRequested = true
            continue
          }
          if (updatedPage) {
            updatedPage.data.forEach(({ id }) =>
              knownNotificationIds.current.add(id)
            )
            setNotificationPage(updatedPage)
          }
        }
      } catch {
        // Preserve the displayed notifications if reconnect synchronization fails.
      } finally {
        synchronizing = false
      }
    }

    const onSubscribed = () => void synchronize()
    const onNotification = (payload: unknown) => {
      if (
        disposed ||
        !payload ||
        typeof payload !== "object" ||
        !("id" in payload) ||
        typeof payload.id !== "string" ||
        !("title" in payload) ||
        typeof payload.title !== "string" ||
        !("body" in payload) ||
        typeof payload.body !== "string"
      ) {
        return
      }

      const notification = payload as AppNotification
      const isNew = !knownNotificationIds.current.has(notification.id)
      knownNotificationIds.current.add(notification.id)
      notificationRevision.current += 1
      setNotificationPage((previous) => {
        const data = previous.data.map((existing) =>
          existing.id === notification.id
            ? {
                ...existing,
                ...notification,
                read_at: existing.read_at ?? notification.read_at,
              }
            : existing
        )
        const total = previous.total + (isNew ? 1 : 0)

        return {
          ...previous,
          data:
            currentPage === 1 && isNew
              ? [notification, ...data].slice(0, pageSize)
              : data,
          total,
          last_page: Math.max(1, Math.ceil(total / pageSize)),
        }
      })
      if (isNew && currentPage > 1) {
        setNewNotificationCount((previous) => previous + 1)
      }
    }

    const onRead = (payload: {
      notification_ids?: string[]
      read_at?: string
    }) => {
      if (
        Array.isArray(payload?.notification_ids) &&
        typeof payload.read_at === "string"
      )
        applyRead(payload.notification_ids, payload.read_at)
    }
    channel.listen(".notifications.read", onRead)
    channel.listen(".notification.created", onNotification)
    channel.listen(".pusher:subscription_succeeded", onSubscribed)
    if (channel.subscription.subscribed) void synchronize()

    return () => {
      disposed = true
      channel.stopListening(".notifications.read", onRead)
      channel.stopListening(".notification.created", onNotification)
      channel.stopListening(".pusher:subscription_succeeded", onSubscribed)
    }
  }, [applyRead, currentPage, currentUserId, echo, pageSize])

  return (
    <div className="space-y-8">
      <PageHeader
        description="Thông báo cập nhật trực tiếp và tự chuyển sang đã đọc khi bạn xem nội dung."
        title="Trung tâm thông báo"
      />
      {newNotificationCount > 0 ? (
        <Surface
          padding="none"
          className="flex items-center justify-between gap-4 border-primary/30 bg-primary/5 p-4"
          role="status"
        >
          <p className="text-sm">Có {newNotificationCount} thông báo mới.</p>
          <Link
            href="/notifications"
            className={buttonVariants({ size: "sm", variant: "outline" })}
          >
            Xem mới nhất
          </Link>
        </Surface>
      ) : null}
      <div ref={containerRef}>
        {notificationPage.data.length ? (
          <Surface padding="none" className="overflow-hidden">
            <ul className="divide-y divide-border">
              {notificationPage.data.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  now={now}
                  origin={origin}
                  onOpen={() => {
                    void readVisible([notification.id]).catch(() => {})
                  }}
                  appeal={
                    <NotificationAppealForm notificationId={notification.id} />
                  }
                />
              ))}
            </ul>
          </Surface>
        ) : (
          <div className="py-8">
            <EmptyState
              title="Bạn chưa có thông báo"
              description="Cập nhật về tài khoản, cửa hàng và hoạt động mua sắm sẽ xuất hiện tại đây."
            />
          </div>
        )}
      </div>
      <DataPagination
        currentPage={notificationPage.current_page}
        lastPage={notificationPage.last_page}
      />
    </div>
  )
}
