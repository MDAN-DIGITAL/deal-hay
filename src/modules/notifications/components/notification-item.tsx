"use client"

import Link from "next/link"
import {
  ArrowUpRightIcon,
  BellIcon,
  CircleAlertIcon,
  LifeBuoyIcon,
  ShoppingBagIcon,
  StoreIcon,
  UserRoundIcon,
} from "lucide-react"

import { ChatPageLink } from "@/components/chat-page-link"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { NotificationAppealForm } from "@/modules/notifications/components/notification-appeal-form"
import { UserAvatar } from "@/components/user-avatar"
import { cn } from "@/lib/utils"
import { parseChatNavigationTarget } from "@/modules/chats/lib/chat-navigation"
import {
  notificationPresentation,
  notificationTimestamp,
} from "@/modules/notifications/lib/notification-presentation"
import {
  notificationToastHref,
  toastAvatar,
} from "@/modules/realtime/lib/toast-destination"
import type { AppNotification } from "@/types/notification"

const categoryIcons = {
  order: ShoppingBagIcon,
  support: LifeBuoyIcon,
  warning: CircleAlertIcon,
  shop: StoreIcon,
  account: UserRoundIcon,
  general: BellIcon,
}

export function NotificationItem({
  notification,
  now,
  origin,
  onOpen,
}: {
  notification: AppNotification
  now: number
  origin: string
  onOpen: () => void
}) {
  const unread = !notification.read_at
  const presentation = notificationPresentation(notification.category ?? "")
  const CategoryIcon = categoryIcons[presentation.kind]
  const timestamp = notificationTimestamp(notification.created_at, now)
  const sender = toastAvatar(notification, "Deal Hay")
  const actionHref = notificationToastHref(notification, origin)
  const DestinationLink =
    actionHref && parseChatNavigationTarget(actionHref.split(/[?#]/, 1)[0])
      ? ChatPageLink
      : Link

  return (
    <li className={cn("px-1 py-3", unread && "bg-primary/5")}>
      <div className="flex gap-3">
        <div className="relative h-10 w-10 shrink-0">
          {notification.sender || sender.src ? (
            <>
              <UserAvatar
                className="size-10"
                name={sender.name}
                src={sender.src}
              />
              <span className="absolute -right-1 -bottom-1 flex size-5 items-center justify-center rounded-full bg-card text-primary ring-2 ring-card">
                <CategoryIcon aria-hidden="true" className="size-3" />
              </span>
            </>
          ) : (
            <span
              className={cn(
                "flex size-10 items-center justify-center rounded-full bg-secondary text-muted-foreground",
                unread && "bg-primary/10 text-primary",
                presentation.kind === "warning" && "bg-warning/10 text-warning"
              )}
            >
              <CategoryIcon aria-hidden="true" className="size-5" />
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div
            data-notification-id={notification.id}
            data-unread={unread}
            className="min-w-0"
          >
            <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs leading-5 text-muted-foreground">
              <span className="font-medium">{presentation.label}</span>
              <span aria-hidden="true">·</span>
              <span className="wrap-anywhere">{sender.name}</span>
              <span className="ml-auto inline-flex shrink-0 items-center gap-1.5">
                {unread ? (
                  <>
                    <span
                      aria-hidden="true"
                      className="size-1.5 rounded-full bg-primary"
                    />
                    <span className="font-medium text-primary">Chưa đọc</span>
                  </>
                ) : (
                  <span>Đã đọc</span>
                )}
              </span>
            </div>
            <h2
              className={cn(
                "text-sm leading-5 wrap-anywhere text-foreground",
                unread ? "font-semibold" : "font-medium"
              )}
            >
              {notification.title}
            </h2>
            <p className="mt-1 text-sm leading-5 wrap-anywhere whitespace-pre-line text-muted-foreground">
              {notification.body}
            </p>
            <time
              aria-label={timestamp.exact}
              className="mt-2 block text-xs leading-5 text-muted-foreground"
              dateTime={timestamp.dateTime}
              title={timestamp.exact}
            >
              {timestamp.relative}
            </time>
          </div>

          {actionHref ? (
            <Button
              aria-label={`${presentation.actionLabel}: ${notification.title}`}
              className="mt-2 px-0"
              size="sm"
              variant="link"
              nativeButton={false}
              render={<DestinationLink href={actionHref} />}
              onClick={onOpen}
            >
              {presentation.actionLabel}
              <ArrowUpRightIcon aria-hidden="true" />
            </Button>
          ) : null}

          <Accordion className="mt-1">
            <AccordionItem value="appeal">
              <AccordionTrigger className="flex-none gap-2 py-2 text-xs font-normal text-muted-foreground">
                Cần hỗ trợ về thông báo này?
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-1">
                <div className="rounded-lg border bg-background p-3 sm:p-4">
                  <NotificationAppealForm notificationId={notification.id} />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>
    </li>
  )
}
