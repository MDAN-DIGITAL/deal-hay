"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import type { ConnectionStatus } from "@/lib/realtime-client"
import {
  ArrowLeftIcon,
  CheckCheckIcon,
  HouseIcon,
  LoaderCircleIcon,
  MessageCircleIcon,
  MoreHorizontalIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  WifiIcon,
  WifiOffIcon,
} from "lucide-react"
import { toast } from "sonner"

import type {
  ChatHistoryResponse,
  ChatMessagesReadEvent,
} from "@/api/chats/types"
import { NotificationSoundToggle } from "@/components/layout/notification-sound-toggle"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { useRealtime } from "@/components/realtime-provider"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { UserAvatar } from "@/components/user-avatar"
import {
  heartbeatPresenceAction,
  markConversationReadAction,
  synchronizeChatsAction,
} from "@/modules/chats/actions"
import { ChatAttachmentProvider } from "@/modules/chats/components/chat-image-attachment"
import { ChatComposer } from "@/modules/chats/components/chat-composer"
import { ChatConversationList } from "@/modules/chats/components/chat-conversation-list"
import { ChatMessageList } from "@/modules/chats/components/chat-message-list"
import type { ChatScrollPosition } from "@/modules/chats/lib/chat-scroll"
import {
  CHAT_NAVIGATION_EVENT,
  navigateToChat,
  parseChatNavigationTarget,
  resolveChatNavigationTarget,
  type ChatNavigationTarget,
} from "@/modules/chats/lib/chat-navigation"
import { useChatRealtime } from "@/modules/chats/hooks/use-chat-realtime"
import {
  createChatState,
  receiveChatHistory,
  markChatConversationRead,
  receiveChatMessage,
  receiveReadReceipt,
  reconcileChatState,
  selectChatConversation,
} from "@/modules/chats/lib/chat-state"
import type {
  ChatMessage,
  ChatReply,
  ConversationSummary,
  SelectedConversation,
} from "@/types/chat"

function RealtimeStatusBadge({ status }: { status: ConnectionStatus }) {
  if (status === "connected") {
    return (
      <Badge
        variant="outline"
        className="gap-1.5 border-0 bg-transparent px-0 text-[11px] font-normal text-muted-foreground"
      >
        <span className="size-1.5 rounded-full bg-emerald-500" /> Đã kết nối
      </Badge>
    )
  }
  if (status === "connecting" || status === "reconnecting") {
    return (
      <Badge
        variant="outline"
        className="border-0 px-0 text-[11px] font-normal"
      >
        <LoaderCircleIcon className="animate-spin" /> Đang kết nối
      </Badge>
    )
  }
  return (
    <Badge
      variant="destructive"
      className="border-0 px-0 text-[11px] font-normal"
    >
      <WifiOffIcon /> Mất kết nối
    </Badge>
  )
}

export function ChatsPageClient({
  conversations,
  selectedConversation,
  currentUserId,
  conversationSnapshots = [],
  conversationAliases = [],
  admins = [],
  embedded = false,
  active = true,
  onConversationChange,
}: {
  conversations: ConversationSummary[]
  selectedConversation: SelectedConversation | null
  currentUserId: string
  conversationSnapshots?: SelectedConversation[]
  conversationAliases?: import("@/types/chat").ConversationAlias[]
  admins?: { id: string; name: string }[]
  embedded?: boolean
  active?: boolean
  onConversationChange?: (slug?: string) => void
}) {
  const frameRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState(() =>
    createChatState(
      {
        conversations,
        selectedConversation,
        conversationSnapshots,
        conversationAliases,
        admins,
      },
      currentUserId
    )
  )
  const scrollPositions = useRef(new Map<string, ChatScrollPosition>())
  const getScrollPosition = useCallback(
    (slug: string) => scrollPositions.current.get(slug),
    []
  )
  const saveScrollPosition = useCallback(
    (slug: string, position: ChatScrollPosition) => {
      scrollPositions.current.set(slug, position)
    },
    []
  )
  const [openedConversationSlugs, setOpenedConversationSlugs] = useState(
    () => new Set(selectedConversation ? [selectedConversation.slug] : [])
  )
  const [navigation, setNavigation] = useState<{
    target: ChatNavigationTarget | null
    requestId: number
  }>({ target: null, requestId: 0 })
  useEffect(() => {
    if (embedded) return
    const restoreSelection = () => {
      const target = parseChatNavigationTarget(
        window.location.pathname,
        window.location.search
      )
      setNavigation((current) => ({ target, requestId: current.requestId + 1 }))
    }
    restoreSelection()
    window.addEventListener("popstate", restoreSelection)
    window.addEventListener(CHAT_NAVIGATION_EVENT, restoreSelection)
    return () => {
      window.removeEventListener("popstate", restoreSelection)
      window.removeEventListener(CHAT_NAVIGATION_EVENT, restoreSelection)
    }
  }, [embedded])

  useEffect(() => {
    if (!navigation.target) return
    const conversation = resolveChatNavigationTarget(
      state.conversationCache,
      navigation.target,
      state.conversationAliases
    )
    if (
      conversation?.id === state.selectedConversation?.id &&
      (!conversation || openedConversationSlugs.has(conversation.slug))
    )
      return
    const frame = window.requestAnimationFrame(() => {
      setState((current) => selectChatConversation(current, conversation?.slug))
      if (conversation)
        setOpenedConversationSlugs((current) =>
          current.has(conversation.slug)
            ? current
            : new Set([...current, conversation.slug])
        )
    })
    return () => window.cancelAnimationFrame(frame)
  }, [
    navigation,
    openedConversationSlugs,
    state.conversationCache,
    state.conversationAliases,
    state.selectedConversation?.id,
  ])

  const selectConversation = useCallback(
    (slug?: string) => {
      setState((current) => selectChatConversation(current, slug))
      if (slug)
        setOpenedConversationSlugs((current) => new Set([...current, slug]))
      if (!embedded)
        navigateToChat(
          slug ? `/chats/${encodeURIComponent(slug)}` : "/chats",
          () => {}
        )
    },
    [embedded]
  )

  const conversationItems = state.conversations
  const activeConversation = state.selectedConversation
  useEffect(() => {
    onConversationChange?.(activeConversation?.slug)
  }, [activeConversation?.slug, onConversationChange])
  const [, startReadTransition] = useTransition()
  const [synchronizationFailed, setSynchronizationFailed] = useState(false)
  const [replyDrafts, setReplyDrafts] = useState<Record<string, ChatReply>>({})
  const { synchronizeUnreadCounts, heartbeatIntervalSeconds } = useRealtime()
  const socketIdRef = useRef<string | undefined>(undefined)
  const mounted = useRef(true)
  const synchronization = useRef<Promise<void> | null>(null)
  const synchronizeAgain = useRef(false)
  const conversationRevisions = useRef(new Map<string, number>())
  const messageRevisions = useRef(new Map<string, number>())
  const conversationId = activeConversation?.id
  const conversationSlug = activeConversation?.slug
  const markAsReadRef = useRef<() => void>(() => {})
  const reading = useRef(new Set<string>())
  const requestedNavigation = useRef(0)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const synchronize = useCallback(() => {
    synchronizeAgain.current = true
    if (synchronization.current) return
    synchronization.current = (async () => {
      while (synchronizeAgain.current && mounted.current) {
        synchronizeAgain.current = false
        const revisions = new Map(conversationRevisions.current)
        const snapshot = await synchronizeChatsAction()
        if (!mounted.current) return
        if (!snapshot) {
          setSynchronizationFailed(true)
          return
        }
        setSynchronizationFailed(false)
        const changed = new Set(
          [...conversationRevisions.current]
            .filter(([id, revision]) => revisions.get(id) !== revision)
            .map(([id]) => id)
        )
        setState((current) => reconcileChatState(current, snapshot, changed))
        if (
          snapshot.selectedConversation?.unread_count &&
          document.visibilityState === "visible" &&
          document.hasFocus()
        ) {
          markAsReadRef.current()
        }
        await synchronizeUnreadCounts()
      }
    })().finally(() => {
      synchronization.current = null
    })
  }, [synchronizeUnreadCounts])

  useEffect(() => {
    const target = navigation.target
    if (!target?.conversationId && !target?.conversationSlug) return
    const conversation = resolveChatNavigationTarget(
      state.conversationCache,
      target,
      state.conversationAliases
    )
    if (
      conversation &&
      (!target.messageId ||
        conversation.messages.some(({ id }) => id === target.messageId))
    )
      return
    if (requestedNavigation.current === navigation.requestId) return
    requestedNavigation.current = navigation.requestId
    synchronize()
  }, [
    navigation,
    state.conversationCache,
    state.conversationAliases,
    synchronize,
  ])

  const markAsRead = useCallback(
    (showConfirmation = false, socketId?: string) => {
      if (
        !active ||
        !conversationId ||
        !conversationSlug ||
        reading.current.has(conversationId)
      )
        return
      reading.current.add(conversationId)
      const revision = messageRevisions.current.get(conversationId)
      startReadTransition(async () => {
        const result = await markConversationReadAction(
          conversationSlug,
          socketId
        )
        reading.current.delete(conversationId)
        if (!mounted.current) return
        if (!result.success) {
          if (showConfirmation) toast.error(result.message)
          return
        }
        if (revision === messageRevisions.current.get(conversationId)) {
          conversationRevisions.current.set(
            conversationId,
            (conversationRevisions.current.get(conversationId) ?? 0) + 1
          )
          setState((current) =>
            markChatConversationRead(
              current,
              conversationId,
              currentUserId,
              new Date().toISOString()
            )
          )
        } else {
          synchronize()
        }
        await synchronizeUnreadCounts()
        if (showConfirmation) toast.success(result.message)
      })
    },
    [
      active,
      conversationId,
      conversationSlug,
      currentUserId,
      synchronize,
      synchronizeUnreadCounts,
    ]
  )

  useEffect(() => {
    markAsReadRef.current = () => markAsRead(false, socketIdRef.current)
  }, [markAsRead])

  const handleIncomingMessage = useCallback(
    (message: ChatMessage) => {
      messageRevisions.current.set(
        message.conversation_id,
        (messageRevisions.current.get(message.conversation_id) ?? 0) + 1
      )
      const revisions = conversationRevisions.current
      revisions.set(
        message.conversation_id,
        (revisions.get(message.conversation_id) ?? 0) + 1
      )
      setState((current) => receiveChatMessage(current, message, currentUserId))
      if (!conversationItems.some(({ id }) => id === message.conversation_id))
        synchronize()
      if (
        activeConversation?.id === message.conversation_id &&
        document.visibilityState === "visible" &&
        document.hasFocus()
      ) {
        markAsRead(false, socketIdRef.current)
      }
    },
    [
      activeConversation?.id,
      conversationItems,
      currentUserId,
      markAsRead,
      synchronize,
    ]
  )

  const handleMessagesRead = useCallback(
    (event: ChatMessagesReadEvent) => {
      const revisions = conversationRevisions.current
      revisions.set(
        event.conversation_id,
        (revisions.get(event.conversation_id) ?? 0) + 1
      )
      setState((current) => receiveReadReceipt(current, event, currentUserId))
      if (event.reader_id === currentUserId) void synchronizeUnreadCounts()
    },
    [currentUserId, synchronizeUnreadCounts]
  )

  const handlePresenceChange = useCallback((isOnline: boolean) => {
    setState((current) => {
      const selected = current.selectedConversation
      if (!selected || selected.counterpart.is_online === isOnline)
        return current
      return {
        ...current,
        selectedConversation: {
          ...selected,
          counterpart: { ...selected.counterpart, is_online: isOnline },
        },
        conversationCache: new Map([
          ...current.conversationCache,
          [
            selected.id,
            {
              ...selected,
              counterpart: { ...selected.counterpart, is_online: isOnline },
            },
          ],
        ]),
        conversations: current.conversations.map((conversation) =>
          conversation.id === selected.id
            ? {
                ...conversation,
                counterpart: {
                  ...conversation.counterpart,
                  is_online: isOnline,
                },
              }
            : conversation
        ),
      }
    })
  }, [])

  const { socketId, status, reconnect } = useChatRealtime({
    currentUserId,
    selectedConversationId: active ? activeConversation?.id : undefined,
    counterpartId: active ? activeConversation?.counterpart.id : undefined,
    onMessage: handleIncomingMessage,
    onMessagesRead: handleMessagesRead,
    onPresenceChange: handlePresenceChange,
    onReconnect: synchronize,
  })

  useEffect(() => {
    socketIdRef.current = socketId
  }, [socketId])

  const handleSent = useCallback(
    (message: ChatMessage) => {
      messageRevisions.current.set(
        message.conversation_id,
        (messageRevisions.current.get(message.conversation_id) ?? 0) + 1
      )
      const revisions = conversationRevisions.current
      revisions.set(
        message.conversation_id,
        (revisions.get(message.conversation_id) ?? 0) + 1
      )
      setState((current) => receiveChatMessage(current, message, currentUserId))
    },
    [currentUserId]
  )

  const handleReply = useCallback(
    (message: ChatMessage) => {
      if (message.conversation_id !== conversationId) return
      setReplyDrafts((current) => ({
        ...current,
        [message.conversation_id]: {
          id: message.id,
          body: message.body,
          sender: message.sender,
          attachment: message.attachment
            ? {
                type: message.attachment.type,
                name: message.attachment.name,
              }
            : null,
          product: message.product ? { name: message.product.name } : null,
        },
      }))
    },
    [conversationId]
  )

  const handleOlderMessages = useCallback(
    (id: string, history: ChatHistoryResponse) => {
      setState((current) => receiveChatHistory(current, id, history))
    },
    []
  )

  useEffect(() => {
    const pulse = () => {
      if (document.visibilityState === "visible")
        void heartbeatPresenceAction(
          active ? activeConversation?.id : undefined
        )
    }
    pulse()
    const interval = window.setInterval(pulse, heartbeatIntervalSeconds * 1000)
    document.addEventListener("visibilitychange", pulse)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener("visibilitychange", pulse)
    }
  }, [active, activeConversation?.id, heartbeatIntervalSeconds])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (
        document.visibilityState === "visible" &&
        document.hasFocus() &&
        activeConversation?.unread_count
      )
        markAsRead(false, socketId)
    }
    const timer = window.setTimeout(handleVisibilityChange, 300)
    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("focus", handleVisibilityChange)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("focus", handleVisibilityChange)
    }
  }, [activeConversation?.unread_count, markAsRead, socketId])

  useEffect(() => {
    if (embedded) return
    const root = document.documentElement
    const body = document.body
    const rootWasLocked = root.classList.contains("overflow-hidden")
    const bodyWasLocked = body.classList.contains("overflow-hidden")

    root.classList.add("overflow-hidden")
    body.classList.add("overflow-hidden")

    return () => {
      if (!rootWasLocked) root.classList.remove("overflow-hidden")
      if (!bodyWasLocked) body.classList.remove("overflow-hidden")
    }
  }, [embedded])

  useEffect(() => {
    if (embedded) return
    const frame = frameRef.current
    const viewport = window.visualViewport
    if (!frame || !viewport) return
    const resize = () => {
      const top = Math.max(0, viewport.offsetTop)
      frame.style.top = `${top}px`
      frame.style.height = `${Math.max(0, viewport.height + viewport.offsetTop - top)}px`
    }
    resize()
    viewport.addEventListener("resize", resize)
    viewport.addEventListener("scroll", resize)
    return () => {
      viewport.removeEventListener("resize", resize)
      viewport.removeEventListener("scroll", resize)
      frame.style.removeProperty("top")
      frame.style.removeProperty("height")
    }
  }, [embedded])

  return (
    <ChatAttachmentProvider messages={state.knownMessages.values()}>
      <div
        ref={frameRef}
        data-chat-layout={embedded ? "embedded" : "page"}
        className={
          embedded
            ? "chat-surface flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-background text-foreground"
            : "chat-surface fixed inset-x-0 top-0 z-40 h-dvh overflow-hidden bg-background text-foreground"
        }
      >
        <div className="flex h-full min-h-0 w-full flex-col">
          <Card className="min-h-0 flex-1 gap-0 overflow-hidden rounded-none border-0 bg-background py-0 shadow-none">
            <div
              className={`grid h-full min-h-0 overflow-hidden ${embedded ? "" : "md:grid-cols-[304px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)]"}`}
            >
              <aside
                className={`${activeConversation ? (embedded ? "hidden" : "hidden md:flex") : "flex"} min-h-0 flex-col overflow-hidden bg-card ${embedded ? "" : "md:border-r"}`}
              >
                <ChatConversationList
                  conversations={conversationItems}
                  selectedConversationId={activeConversation?.id}
                  onSelect={selectConversation}
                  embedded={embedded}
                />
                {!embedded ? (
                  <div className="flex shrink-0 items-center justify-between gap-2 border-t px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                    <Link
                      href="/"
                      className="flex items-center gap-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <HouseIcon className="size-4" /> Về Deal Hay
                    </Link>
                    <div className="flex items-center gap-1">
                      <ThemeToggle />
                      <NotificationSoundToggle />
                    </div>
                  </div>
                ) : null}
              </aside>

              <section
                className={`${activeConversation ? "flex" : embedded ? "hidden" : "hidden md:flex"} min-h-0 min-w-0 flex-col overflow-hidden`}
              >
                {activeConversation ? (
                  <>
                    <div
                      className={`flex shrink-0 items-center justify-between gap-3 border-b bg-card px-3 pb-3 ${embedded ? "pt-3" : "pt-[max(0.75rem,env(safe-area-inset-top))] md:pt-3"} md:px-6`}
                    >
                      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                        <Link
                          href="/chats"
                          onClick={(event) => {
                            event.preventDefault()
                            selectConversation()
                          }}
                          className={buttonVariants({
                            className: embedded
                              ? "rounded-xl"
                              : "rounded-xl md:hidden",
                            size: "icon-lg",
                            variant: "ghost",
                          })}
                        >
                          <ArrowLeftIcon />
                          <span className="sr-only">Quay lại danh sách</span>
                        </Link>
                        <UserAvatar
                          name={activeConversation.counterpart.name}
                          size="lg"
                          src={activeConversation.counterpart.avatar_url}
                        />
                        <div className="min-w-0">
                          <p className="flex min-w-0 items-center gap-1.5 text-[15px] font-semibold">
                            <span className="truncate">
                              {activeConversation.counterpart.name}
                            </span>
                            {activeConversation.is_support ? (
                              <ShieldCheckIcon
                                className="size-3.5 shrink-0 text-primary"
                                aria-label="Hỗ trợ chính thức"
                              />
                            ) : null}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {activeConversation.is_support
                              ? activeConversation.counterpart.is_online
                                ? "Đội ngũ hỗ trợ đang trực tuyến"
                                : "Đội ngũ hỗ trợ khách hàng"
                              : activeConversation.counterpart.is_online
                                ? "Đang hoạt động"
                                : "Không trực tuyến"}
                            {!activeConversation.is_support &&
                            activeConversation.participants?.some(
                              (person) => person.is_admin
                            )
                              ? ` · Admin: ${activeConversation.participants
                                  .filter((person) => person.is_admin)
                                  .map((person) => person.name)
                                  .join(", ")}`
                              : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <div className="hidden sm:block">
                          <RealtimeStatusBadge status={status} />
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                aria-label="Tùy chọn cuộc trò chuyện"
                                title="Tùy chọn cuộc trò chuyện"
                                size="icon-lg"
                                variant="ghost"
                                className="rounded-xl"
                              />
                            }
                          >
                            <MoreHorizontalIcon />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="chat-surface min-w-56"
                          >
                            <DropdownMenuItem
                              onClick={() => markAsRead(true, socketId)}
                            >
                              <CheckCheckIcon /> Đánh dấu đã đọc
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={synchronize}>
                              <RefreshCwIcon /> Đồng bộ tin nhắn
                            </DropdownMenuItem>
                            {status === "failed" ||
                            status === "disconnected" ? (
                              <DropdownMenuItem onClick={reconnect}>
                                <WifiIcon /> Kết nối lại
                              </DropdownMenuItem>
                            ) : null}
                            <DropdownMenuItem render={<Link href="/" />}>
                              <HouseIcon /> Về trang chủ
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    {status !== "connected" || synchronizationFailed ? (
                      <div
                        role="status"
                        className="flex shrink-0 items-center justify-center gap-3 border-b bg-card/70 px-4 py-2 text-xs text-muted-foreground"
                      >
                        <RealtimeStatusBadge status={status} />
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-xs"
                          onClick={
                            status === "connected" ? synchronize : reconnect
                          }
                        >
                          {status === "connected"
                            ? "Đồng bộ lại"
                            : "Thử kết nối lại"}
                        </Button>
                      </div>
                    ) : null}

                    <ChatMessageList
                      key={`messages-${activeConversation.id}`}
                      conversationSlug={activeConversation.slug}
                      currentUserId={currentUserId}
                      focusMessage={
                        navigation.target?.messageId
                          ? {
                              id: navigation.target.messageId,
                              requestId: navigation.requestId,
                            }
                          : undefined
                      }
                      getScrollPosition={getScrollPosition}
                      onScrollPositionChange={saveScrollPosition}
                      messages={activeConversation.messages}
                      pagination={activeConversation.messages_pagination}
                      onOlderMessages={(history) =>
                        handleOlderMessages(activeConversation.id, history)
                      }
                      onReply={handleReply}
                    />
                  </>
                ) : (
                  <CardContent className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
                    <span className="flex size-20 items-center justify-center rounded-3xl border bg-card shadow-sm">
                      <MessageCircleIcon className="size-9 text-primary" />
                    </span>
                    <div className="max-w-72 space-y-2">
                      <h2 className="text-xl font-semibold tracking-tight">
                        Cuộc trò chuyện của bạn
                      </h2>
                      <p className="text-sm leading-6 text-muted-foreground">
                        Chọn một cuộc trò chuyện để nhắn tin với cửa hàng hoặc
                        nhận hỗ trợ từ Deal Hay.
                      </p>
                    </div>
                    <RealtimeStatusBadge status={status} />
                  </CardContent>
                )}
                {[...openedConversationSlugs].map((slug) => {
                  const conversation = [
                    ...state.conversationCache.values(),
                  ].find((item) => item.slug === slug)
                  if (!conversation) return null
                  const id = conversation.id
                  return (
                    <div
                      key={`${currentUserId}:${id}`}
                      hidden={activeConversation?.id !== id}
                      className="shrink-0"
                    >
                      <ChatComposer
                        admins={state.admins ?? admins}
                        confirmedClientMessageIds={conversation.messages.flatMap(
                          (message) =>
                            message.client_message_id
                              ? [message.client_message_id]
                              : []
                        )}
                        conversationSlug={conversation.slug}
                        replyTo={replyDrafts[id] ?? null}
                        socketId={socketId}
                        onCancelReply={() =>
                          setReplyDrafts((current) => {
                            const next = { ...current }
                            delete next[id]
                            return next
                          })
                        }
                        onSent={handleSent}
                      />
                    </div>
                  )
                })}
              </section>
            </div>
          </Card>
        </div>
      </div>
    </ChatAttachmentProvider>
  )
}
