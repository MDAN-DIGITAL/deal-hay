"use client"

import Link from "next/link"
import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
} from "react"
import {
  CheckCheckIcon,
  CheckIcon,
  LoaderCircleIcon,
  MessageCircleIcon,
  ReplyIcon,
} from "lucide-react"
import { toast } from "sonner"

import { MediaImage } from "@/components/media-image"
import { Button } from "@/components/ui/button"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageGroup,
  MessageBubble,
} from "@/components/ui/message"
import { ScrollArea } from "@/components/ui/scroll-area"
import { UserAvatar } from "@/components/user-avatar"
import { formatCurrency, formatDate, formatShortDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import { loadChatHistoryAction } from "@/modules/chats/actions"
import {
  ChatImageAttachment,
  DownloadAttachment,
} from "@/modules/chats/components/chat-image-attachment"
import { ChatReplyPreview } from "@/modules/chats/components/chat-reply-preview"
import {
  CHAT_MESSAGE_RENDER_WINDOW,
  chatMessageStartForTarget,
  initialChatMessageStart,
  type ChatScrollPosition,
} from "@/modules/chats/lib/chat-scroll"
import type { ChatHistoryResponse } from "@/api/chats/types"
import type { ChatMessage } from "@/types/chat"

const messageTime = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  hour: "2-digit",
  minute: "2-digit",
})

function messageDay(message?: ChatMessage) {
  return message?.created_at && Number.isFinite(Date.parse(message.created_at))
    ? formatShortDate(message.created_at)
    : null
}

function continuesGroup(
  previous: ChatMessage | undefined,
  current: ChatMessage
) {
  if (
    !previous?.created_at ||
    !current.created_at ||
    previous.sender.id !== current.sender.id ||
    messageDay(previous) !== messageDay(current)
  ) {
    return false
  }
  const gap = Date.parse(current.created_at) - Date.parse(previous.created_at)
  return gap >= 0 && gap <= 5 * 60 * 1000
}

export function ChatMessageList({
  conversationSlug,
  currentUserId,
  messages,
  pagination,
  onOlderMessages,
  onReply,
  getScrollPosition,
  onScrollPositionChange,
  focusMessage,
}: {
  conversationSlug: string
  currentUserId: string
  messages: ChatMessage[]
  pagination: { has_more: boolean; next_cursor: string | null }
  onOlderMessages: (history: ChatHistoryResponse) => void
  onReply: (message: ChatMessage) => void
  getScrollPosition: (slug: string) => ChatScrollPosition | undefined
  onScrollPositionChange: (slug: string, position: ChatScrollPosition) => void
  focusMessage?: { id: string; requestId: number }
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [isLoadingOlder, startLoadingOlder] = useTransition()
  const [highlightedMessageId, setHighlightedMessageId] = useState<
    string | null
  >(null)
  const messageElements = useRef(new Map<string, HTMLDivElement>())
  const highlightTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastMessageId = messages.at(-1)?.id
  const [firstRenderedMessageId, setFirstRenderedMessageId] = useState(() =>
    initialChatMessageStart(messages, getScrollPosition(conversationSlug))
  )
  const displayedStartId = focusMessage
    ? chatMessageStartForTarget(
        messages,
        focusMessage.id,
        firstRenderedMessageId
      )
    : firstRenderedMessageId
  const startIndex = Math.max(
    0,
    messages.findIndex(({ id }) => id === displayedStartId)
  )
  const visibleMessages = messages.slice(startIndex)
  const firstRenderedIdRef = useRef(displayedStartId)
  const atBottomRef = useRef(true)
  const previousLastMessageId = useRef(lastMessageId)
  const focusedRequest = useRef<number | null>(null)
  useLayoutEffect(() => {
    firstRenderedIdRef.current = displayedStartId
  }, [displayedStartId])
  useLayoutEffect(() => {
    const viewport = containerRef.current?.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    )
    if (!viewport) return
    const saved = getScrollPosition(conversationSlug)
    atBottomRef.current = saved?.atBottom ?? true
    viewport.scrollTop =
      saved && !saved.atBottom ? saved.scrollTop : viewport.scrollHeight
    const remember = () => {
      atBottomRef.current =
        viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop < 80
      onScrollPositionChange(conversationSlug, {
        scrollTop: viewport.scrollTop,
        atBottom: atBottomRef.current,
        firstRenderedMessageId: firstRenderedIdRef.current,
      })
    }
    viewport.addEventListener("scroll", remember, { passive: true })
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            if (atBottomRef.current) viewport.scrollTop = viewport.scrollHeight
          })
    if (viewport.firstElementChild)
      observer?.observe(viewport.firstElementChild)
    return () => {
      remember()
      viewport.removeEventListener("scroll", remember)
      observer?.disconnect()
    }
  }, [conversationSlug, getScrollPosition, onScrollPositionChange])

  useEffect(
    () => () => {
      if (highlightTimeout.current) clearTimeout(highlightTimeout.current)
    },
    []
  )

  const highlightMessage = (id: string) => {
    const element = messageElements.current.get(id)
    if (!element) {
      toast.info(
        "Tin nhắn gốc nằm trong lịch sử cũ. Bấm ‘Xem tin nhắn cũ hơn’ để tìm."
      )
      return
    }

    element.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "center",
    })
    element.focus({ preventScroll: true })
    setHighlightedMessageId(id)
    if (highlightTimeout.current) clearTimeout(highlightTimeout.current)
    highlightTimeout.current = setTimeout(() => {
      setHighlightedMessageId(null)
    }, 2000)
  }

  const jumpToMessage = (id: string) => {
    const firstId = chatMessageStartForTarget(
      messages,
      id,
      firstRenderedMessageId
    )
    if (firstId !== firstRenderedMessageId) {
      setFirstRenderedMessageId(firstId)
      window.requestAnimationFrame(() =>
        window.requestAnimationFrame(() => highlightMessage(id))
      )
      return
    }
    highlightMessage(id)
  }

  useLayoutEffect(() => {
    if (!focusMessage || focusedRequest.current === focusMessage.requestId)
      return
    if (!messages.some(({ id }) => id === focusMessage.id)) return
    const element = messageElements.current.get(focusMessage.id)
    if (!element) return
    atBottomRef.current = false
    const frame = window.requestAnimationFrame(() => {
      if (!element.isConnected) return
      focusedRequest.current = focusMessage.requestId
      setFirstRenderedMessageId(displayedStartId)
      element.scrollIntoView({ behavior: "instant", block: "center" })
      element.focus({ preventScroll: true })
      setHighlightedMessageId(focusMessage.id)
      if (highlightTimeout.current) clearTimeout(highlightTimeout.current)
      highlightTimeout.current = setTimeout(
        () => setHighlightedMessageId(null),
        2000
      )
    })
    return () => window.cancelAnimationFrame(frame)
  }, [focusMessage, messages, displayedStartId])

  useLayoutEffect(() => {
    if (
      previousLastMessageId.current !== lastMessageId &&
      (atBottomRef.current || messages.at(-1)?.sender.id === currentUserId)
    ) {
      const viewport = containerRef.current?.querySelector<HTMLElement>(
        '[data-slot="scroll-area-viewport"]'
      )
      if (viewport) viewport.scrollTop = viewport.scrollHeight
    }
    previousLastMessageId.current = lastMessageId
  }, [lastMessageId, currentUserId, messages])

  const loadOlder = () => {
    const viewport = containerRef.current?.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    )
    const previousHeight = viewport?.scrollHeight ?? 0
    const previousTop = viewport?.scrollTop ?? 0
    if (startIndex > 0) {
      setFirstRenderedMessageId(
        messages[Math.max(0, startIndex - CHAT_MESSAGE_RENDER_WINDOW)].id
      )
      window.requestAnimationFrame(() => {
        if (viewport)
          viewport.scrollTop =
            previousTop + (viewport.scrollHeight - previousHeight)
      })
      return
    }
    if (!pagination.next_cursor) return

    startLoadingOlder(async () => {
      const state = await loadChatHistoryAction(
        conversationSlug,
        pagination.next_cursor as string
      )
      if (!state.success || !state.data) {
        toast.error(state.message || "Không thể tải thêm tin nhắn.")
        return
      }

      onOlderMessages(state.data)
      if (state.data.messages[0])
        setFirstRenderedMessageId(state.data.messages[0].id)
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          if (viewport) {
            viewport.scrollTop =
              previousTop + (viewport.scrollHeight - previousHeight)
          }
        })
      })
    })
  }

  return (
    <div
      ref={containerRef}
      className="min-h-0 flex-1 overflow-hidden bg-background"
    >
      <ScrollArea className="h-full min-h-0 [&_[data-slot=scroll-area-viewport]]:flex [&_[data-slot=scroll-area-viewport]]:flex-col [&_[data-slot=scroll-area-viewport]>div]:flex [&_[data-slot=scroll-area-viewport]>div]:flex-1 [&_[data-slot=scroll-area-viewport]>div]:flex-col">
        <MessageGroup className="mx-auto w-full max-w-[920px] flex-1 justify-end gap-0 px-3 py-4 sm:px-6 sm:py-5">
          {startIndex > 0 || pagination.has_more ? (
            <Button
              className="mb-3 self-center rounded-full border-border/70 px-4 text-xs text-muted-foreground"
              disabled={isLoadingOlder}
              size="sm"
              variant="outline"
              onClick={loadOlder}
            >
              {isLoadingOlder ? (
                <LoaderCircleIcon className="animate-spin" />
              ) : null}
              {isLoadingOlder ? "Đang tải..." : "Xem tin nhắn cũ hơn"}
            </Button>
          ) : null}

          {messages.length === 0 ? (
            <div className="mx-auto flex min-h-64 max-w-xs flex-col items-center justify-center gap-4 px-4 py-10 text-center">
              <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <MessageCircleIcon className="size-7" />
              </span>
              <div className="space-y-1.5">
                <h3 className="text-base font-semibold">
                  Bắt đầu cuộc trò chuyện
                </h3>
                <p className="text-sm leading-6 text-muted-foreground">
                  Gửi lời chào, đặt câu hỏi hoặc chia sẻ ảnh để trao đổi dễ dàng
                  hơn.
                </p>
              </div>
            </div>
          ) : null}

          {visibleMessages.map((message, index) => {
            const fromCurrentUser = message.sender.id === currentUserId
            const replyTo = message.reply_to
            const previous = visibleMessages[index - 1]
            const next = visibleMessages[index + 1]
            const continuesPrevious = continuesGroup(previous, message)
            const continuesNext = next ? continuesGroup(message, next) : false
            const day = messageDay(message)
            const showDate = day && day !== messageDay(previous)
            const hasTimestamp =
              message.created_at &&
              Number.isFinite(Date.parse(message.created_at))
            const showBody =
              message.body &&
              !(
                message.attachment &&
                ["[Hình ảnh]", "[Video]", "[Tệp đính kèm]"].includes(
                  message.body
                )
              )
            return (
              <Fragment key={message.id}>
                {showDate ? (
                  <div className="flex items-center gap-3 px-2 py-3 first:pt-0">
                    <span
                      aria-hidden="true"
                      className="h-px flex-1 bg-border/60"
                    />
                    <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
                      {day === formatShortDate(new Date().toISOString())
                        ? "Hôm nay"
                        : day}
                    </span>
                    <span
                      aria-hidden="true"
                      className="h-px flex-1 bg-border/60"
                    />
                  </div>
                ) : null}
                <Message
                  ref={(element) => {
                    if (element)
                      messageElements.current.set(message.id, element)
                    else messageElements.current.delete(message.id)
                  }}
                  align={fromCurrentUser ? "end" : "start"}
                  className={cn(
                    "items-end gap-2 rounded-xl text-base transition-colors outline-none sm:text-[15px]",
                    continuesPrevious ? "mt-1" : "mt-2.5",
                    highlightedMessageId === message.id &&
                      "bg-primary/10 ring-2 ring-primary/30"
                  )}
                  data-message-id={message.id}
                  tabIndex={-1}
                >
                  {!fromCurrentUser ? (
                    <div
                      className={cn(
                        "flex w-7 shrink-0 self-end",
                        !continuesNext && "mb-6"
                      )}
                    >
                      {!continuesNext ? (
                        <MessageAvatar className="min-w-7 bg-transparent">
                          <UserAvatar
                            className="size-7"
                            name={message.sender.name}
                            size="sm"
                            src={message.sender.avatar_url}
                          />
                        </MessageAvatar>
                      ) : null}
                    </div>
                  ) : null}
                  <MessageContent
                    className={cn(
                      "w-fit max-w-[85%] gap-1 sm:max-w-[78%]",
                      fromCurrentUser ? "items-end" : "items-start"
                    )}
                  >
                    <div
                      className={cn(
                        "flex max-w-full min-w-0 items-center gap-1",
                        fromCurrentUser && "flex-row-reverse"
                      )}
                    >
                      <MessageBubble
                        align={fromCurrentUser ? "end" : "start"}
                        continuesPrevious={continuesPrevious}
                        continuesNext={continuesNext}
                        title={
                          hasTimestamp
                            ? formatDate(message.created_at)
                            : undefined
                        }
                      >
                        {replyTo ? (
                          <ChatReplyPreview
                            className="mx-1.5 mt-1.5 mb-0.5"
                            outgoing={fromCurrentUser}
                            reply={replyTo}
                            variant="message"
                            onJump={() => jumpToMessage(replyTo.id)}
                          />
                        ) : null}
                        {message.product ? (
                          <div className="p-1.5">
                            <Item
                              className="max-w-sm bg-card text-foreground"
                              render={
                                <Link
                                  href={`/shops/${message.product.shop_code}/products/${message.product.slug}`}
                                />
                              }
                              size="sm"
                              variant="outline"
                            >
                              <ItemMedia>
                                <MediaImage
                                  alt={message.product.name}
                                  className="size-12 rounded-md"
                                  fallbackLabel="Chưa có ảnh"
                                  sizes="48px"
                                  src={message.product.image_url}
                                />
                              </ItemMedia>
                              <ItemContent>
                                <ItemTitle>{message.product.name}</ItemTitle>
                                <ItemDescription>
                                  {formatCurrency(message.product.price)}
                                </ItemDescription>
                              </ItemContent>
                            </Item>
                          </div>
                        ) : null}

                        {message.mentions?.length ? (
                          <div className="flex flex-wrap gap-1 px-3.5 pt-2 text-xs font-medium">
                            {message.mentions.map((admin) => (
                              <span key={admin.id}>@{admin.name}</span>
                            ))}
                          </div>
                        ) : null}
                        {showBody ? (
                          <div className="px-3.5 py-2 text-base leading-relaxed wrap-break-word whitespace-pre-wrap sm:text-[15px]">
                            {message.body}
                          </div>
                        ) : null}

                        {message.attachment ? (
                          <div className="p-1.5 text-foreground">
                            {message.attachment.type === "image" ? (
                              <ChatImageAttachment
                                messageId={message.id}
                                name={message.attachment.name}
                              />
                            ) : null}
                            <DownloadAttachment
                              messageId={message.id}
                              name={message.attachment.name}
                              image={message.attachment.type === "image"}
                            />
                          </div>
                        ) : null}
                      </MessageBubble>
                      <Button
                        aria-label={`Trả lời tin nhắn của ${message.sender.name}`}
                        className="shrink-0 rounded-full text-muted-foreground opacity-60 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within/message:opacity-100 [@media(hover:hover)]:group-hover/message:opacity-100"
                        size="icon-sm"
                        title="Trả lời"
                        type="button"
                        variant="ghost"
                        onClick={() => onReply(message)}
                      >
                        <ReplyIcon />
                      </Button>
                    </div>
                    {!continuesNext ? (
                      <div className="flex items-center gap-1 px-1 pb-0.5 text-[11px] leading-4 text-muted-foreground">
                        <time
                          dateTime={message.created_at ?? undefined}
                          title={
                            hasTimestamp
                              ? formatDate(message.created_at)
                              : undefined
                          }
                        >
                          {hasTimestamp
                            ? messageTime.format(new Date(message.created_at!))
                            : "—"}
                        </time>
                        {fromCurrentUser ? (
                          message.read_at ? (
                            <CheckCheckIcon
                              aria-label="Đã xem"
                              className="size-3.5 text-primary"
                            />
                          ) : (
                            <CheckIcon
                              aria-label="Đã gửi"
                              className="size-3.5"
                            />
                          )
                        ) : null}
                      </div>
                    ) : null}
                  </MessageContent>
                </Message>
              </Fragment>
            )
          })}
          <div ref={bottomRef} aria-hidden="true" />
        </MessageGroup>
      </ScrollArea>
    </div>
  )
}
