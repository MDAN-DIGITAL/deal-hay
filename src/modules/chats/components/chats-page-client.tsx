"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import type { ConnectionStatus } from "@/lib/realtime-client"
import {
  ArrowLeftIcon,
  LoaderCircleIcon,
  WifiIcon,
  WifiOffIcon,
} from "lucide-react"
import { toast } from "sonner"

import type {
  ChatHistoryResponse,
  ChatMessagesReadEvent,
} from "@/api/chats/types"
import { EmptyState } from "@/components/layout/empty-state"
import { PageHeader } from "@/components/layout/page-header"
import { useRealtime } from "@/components/realtime-provider"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
      <Badge variant="secondary">
        <WifiIcon /> Trực tiếp
      </Badge>
    )
  }
  if (status === "connecting" || status === "reconnecting") {
    return (
      <Badge variant="outline">
        <LoaderCircleIcon className="animate-spin" /> Đang kết nối
      </Badge>
    )
  }
  return (
    <Badge variant="destructive">
      <WifiOffIcon /> Mất kết nối
    </Badge>
  )
}

export function ChatsPageClient({
  conversations,
  selectedConversation,
  currentUserId,
  conversationSnapshots = [],
  admins = [],
}: {
  conversations: ConversationSummary[]
  selectedConversation: SelectedConversation | null
  currentUserId: string
  conversationSnapshots?: SelectedConversation[]
  admins?: { id: string; name: string }[]
}) {
  const [state, setState] = useState(() =>
    createChatState(
      {
        conversations,
        selectedConversation,
        conversationSnapshots,
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
  }, [])

  useEffect(() => {
    if (!navigation.target) return
    const conversation = resolveChatNavigationTarget(
      state.conversationCache,
      navigation.target
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
    state.selectedConversation?.id,
  ])

  const selectConversation = useCallback((slug?: string) => {
    setState((current) => selectChatConversation(current, slug))
    if (slug)
      setOpenedConversationSlugs((current) => new Set([...current, slug]))
    navigateToChat(
      slug ? `/chats/${encodeURIComponent(slug)}` : "/chats",
      () => {}
    )
  }, [])

  const conversationItems = state.conversations
  const activeConversation = state.selectedConversation
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
      target
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
  }, [navigation, state.conversationCache, synchronize])

  const markAsRead = useCallback(
    (showConfirmation = false, socketId?: string) => {
      if (
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
    selectedConversationId: activeConversation?.id,
    counterpartId: activeConversation?.counterpart.id,
    onMessage: handleIncomingMessage,
    onMessagesRead: handleMessagesRead,
    onPresenceChange: handlePresenceChange,
    onReconnect: synchronize,
  })

  useEffect(() => {
    socketIdRef.current = socketId
  }, [socketId])

  const handleSent = useCallback(
    (message: ChatMessage, submittedReplyId?: string | null) => {
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
      setReplyDrafts((current) => {
        if (current[message.conversation_id]?.id !== submittedReplyId)
          return current
        const next = { ...current }
        delete next[message.conversation_id]
        return next
      })
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
        void heartbeatPresenceAction(activeConversation?.id)
    }
    pulse()
    const interval = window.setInterval(pulse, heartbeatIntervalSeconds * 1000)
    document.addEventListener("visibilitychange", pulse)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener("visibilitychange", pulse)
    }
  }, [activeConversation?.id, heartbeatIntervalSeconds])

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
  }, [])

  return (
    <ChatAttachmentProvider messages={state.knownMessages.values()}>
      <div className="fixed inset-x-0 top-16 bottom-0 z-30 overflow-hidden bg-background lg:top-24">
        <div className="mx-auto flex h-full min-h-0 w-full max-w-7xl flex-col gap-0 px-0 py-0 sm:gap-3 sm:px-4 sm:py-3 lg:gap-6 lg:px-8 lg:py-6">
          <div
            className={
              activeConversation ? "hidden lg:block" : "px-4 py-3 sm:p-0"
            }
          >
            <PageHeader
              title="Tin nhắn"
              description="Trao đổi trực tiếp với cửa hàng và nhận phản hồi ngay khi có tin nhắn mới."
              actions={
                <div className="flex flex-wrap items-center gap-2">
                  <RealtimeStatusBadge status={status} />
                  {(status === "failed" || status === "disconnected") && (
                    <Button variant="outline" size="sm" onClick={reconnect}>
                      Kết nối lại
                    </Button>
                  )}
                  {status === "connected" && synchronizationFailed && (
                    <Button variant="outline" size="sm" onClick={synchronize}>
                      Đồng bộ lại
                    </Button>
                  )}
                </div>
              }
            />
          </div>
          <Card className="min-h-0 flex-1 gap-0 overflow-hidden rounded-none border-x-0 border-b-0 py-0 sm:rounded-xl sm:border">
            <div className="grid h-full min-h-0 overflow-hidden lg:grid-cols-[340px_minmax(0,1fr)]">
              <aside
                className={`${activeConversation ? "hidden lg:flex" : "flex"} min-h-0 flex-col overflow-hidden border-r`}
              >
                <ChatConversationList
                  conversations={conversationItems}
                  selectedConversationId={activeConversation?.id}
                  onSelect={selectConversation}
                />
              </aside>

              <section
                className={`${activeConversation ? "flex" : "hidden lg:flex"} min-h-0 flex-col overflow-hidden`}
              >
                {activeConversation ? (
                  <>
                    <div className="flex shrink-0 items-center justify-between gap-3 border-b px-3 py-3 sm:px-4">
                      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                        <Link
                          href="/chats"
                          onClick={(event) => {
                            event.preventDefault()
                            selectConversation()
                          }}
                          className={buttonVariants({
                            className: "lg:hidden",
                            size: "icon-sm",
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
                          <p className="truncate font-medium">
                            {activeConversation.counterpart.name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {activeConversation.counterpart.is_online
                              ? "Đang hoạt động"
                              : "Không trực tuyến"}
                            {activeConversation.participants?.some(
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
                    </div>

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
                  <CardContent className="flex h-full items-center justify-center p-6">
                    <EmptyState
                      title="Chọn một cuộc trò chuyện"
                      description="Nội dung trao đổi với người bán hoặc khách hàng sẽ hiển thị tại đây."
                    />
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
                      key={id}
                      hidden={activeConversation?.id !== id}
                      className="shrink-0"
                    >
                      <ChatComposer
                        admins={state.admins ?? admins}
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
