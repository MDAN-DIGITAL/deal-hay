"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { MessageCircleIcon, SearchIcon, ShieldCheckIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { ScrollArea } from "@/components/ui/scroll-area"
import { UserAvatar } from "@/components/user-avatar"
import type { ConversationSummary } from "@/types/chat"

function conversationDate(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return null
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(value))
}

export function ChatConversationList({
  conversations,
  selectedConversationId,
  onSelect,
  embedded = false,
}: {
  conversations: ConversationSummary[]
  selectedConversationId?: string
  onSelect: (slug: string) => void
  embedded?: boolean
}) {
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<"all" | "unread">("all")
  const support = conversations.find((conversation) => conversation.is_support)
  const unreadCount = conversations.filter(
    (conversation) => conversation.unread_count > 0
  ).length
  const filteredConversations = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("vi")
    return conversations.filter(
      (conversation) =>
        !conversation.is_support &&
        (filter !== "unread" || conversation.unread_count > 0) &&
        (!normalized ||
          `${conversation.counterpart.name} ${conversation.last_message ?? ""}`
            .toLocaleLowerCase("vi")
            .includes(normalized))
    )
  }, [conversations, query, filter])

  const renderConversation = (conversation: ConversationSummary) => {
    const selected = selectedConversationId === conversation.id
    const isSupport = conversation.is_support
    const historicalSupport = Boolean(
      "is_support_history" in conversation && conversation.is_support_history
    )
    const date = conversationDate(conversation.updated_at)
    return (
      <Link
        key={conversation.id}
        href={`/chats/${encodeURIComponent(conversation.slug)}`}
        aria-current={selected ? "page" : undefined}
        onClick={(event) => {
          if (
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
          )
            return
          event.preventDefault()
          onSelect(conversation.slug)
        }}
        className={`group flex min-w-0 items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected ? "border-primary/15 bg-primary/[0.09]" : "border-transparent hover:bg-muted/80"}`}
      >
        <div className="relative shrink-0">
          <UserAvatar
            name={isSupport ? "Deal Hay Admin" : conversation.counterpart.name}
            size="lg"
            src={conversation.counterpart.avatar_url}
          />
          {conversation.counterpart.is_online ? (
            <span
              aria-label="Đang trực tuyến"
              className="absolute right-0 bottom-0 size-3 rounded-full border-2 border-card bg-emerald-500"
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <span
              className={`min-w-0 truncate text-[15px] leading-5 ${selected || conversation.unread_count > 0 ? "font-semibold" : "font-medium"}`}
            >
              {isSupport ? "Deal Hay Admin" : conversation.counterpart.name}
            </span>
            {isSupport ? (
              <ShieldCheckIcon
                aria-label="Hỗ trợ chính thức"
                className="size-3.5 shrink-0 text-primary"
              />
            ) : null}
            {date && !isSupport ? (
              <time
                className="ml-auto shrink-0 text-[11px] text-muted-foreground"
                dateTime={conversation.updated_at ?? undefined}
              >
                {date}
              </time>
            ) : null}
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <p
              className={`min-w-0 flex-1 truncate text-[13px] leading-5 ${conversation.unread_count > 0 ? "font-medium text-foreground/85" : "text-muted-foreground"}`}
            >
              {historicalSupport ? "Hỗ trợ trước đây · " : ""}
              {conversation.last_message?.trim() ||
                (isSupport
                  ? "Bạn cần hỗ trợ? Nhắn tin cho chúng tôi"
                  : "Bắt đầu cuộc trò chuyện")}
            </p>
            {conversation.unread_count > 0 ? (
              <Badge className="h-5 min-w-5 justify-center rounded-full bg-[var(--chat-outgoing)] px-1.5 text-[10px] text-white">
                {conversation.unread_count > 99
                  ? "99+"
                  : conversation.unread_count}
              </Badge>
            ) : null}
          </div>
        </div>
      </Link>
    )
  }

  return (
    <>
      <div
        className={`shrink-0 space-y-4 px-4 pb-3 ${embedded ? "pt-4" : "pt-[max(1.25rem,env(safe-area-inset-top))]"}`}
      >
        {!embedded ? (
          <div className="flex items-center gap-2.5 px-1">
            <MessageCircleIcon className="size-6 text-primary" />
            <h1 className="text-2xl font-semibold tracking-tight">Tin nhắn</h1>
          </div>
        ) : null}
        <InputGroup className="h-11 rounded-xl border-transparent bg-muted/80 shadow-none">
          <InputGroupAddon>
            <SearchIcon className="size-4" />
          </InputGroupAddon>
          <InputGroupInput
            aria-label="Tìm cuộc trò chuyện"
            className="h-11 text-base placeholder:text-muted-foreground/80 md:text-sm"
            placeholder="Tìm cuộc trò chuyện..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query ? (
            <button
              type="button"
              aria-label="Xóa tìm kiếm"
              className="mr-1 flex size-8 shrink-0 items-center justify-center rounded-lg text-lg text-muted-foreground hover:bg-background"
              onClick={() => setQuery("")}
            >
              ×
            </button>
          ) : null}
        </InputGroup>
        <div
          className="flex items-center gap-1.5"
          aria-label="Lọc cuộc trò chuyện"
        >
          <button
            type="button"
            aria-pressed={filter === "all"}
            onClick={() => setFilter("all")}
            className={`min-h-8 rounded-full px-3 text-xs font-medium transition-colors ${filter === "all" ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"}`}
          >
            Tất cả
          </button>
          <button
            type="button"
            aria-pressed={filter === "unread"}
            onClick={() => setFilter("unread")}
            className={`min-h-8 rounded-full px-3 text-xs font-medium transition-colors ${filter === "unread" ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"}`}
          >
            Chưa đọc{unreadCount ? ` (${unreadCount})` : ""}
          </button>
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-1 px-2 pb-4">
          <p className="px-3 pt-2 pb-1 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            Hỗ trợ Deal Hay
          </p>
          {support ? (
            renderConversation(support)
          ) : (
            <div
              className="flex items-center gap-3 rounded-xl px-3 py-3"
              aria-disabled="true"
            >
              <UserAvatar name="Deal Hay Admin" size="lg" src={null} />
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[15px] font-medium">
                  Deal Hay Admin
                  <ShieldCheckIcon className="size-3.5 text-primary" />
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Bộ phận hỗ trợ chưa sẵn sàng
                </p>
              </div>
            </div>
          )}
          <p className="px-3 pt-5 pb-1 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            {filter === "unread" ? "Tin nhắn chưa đọc" : "Gần đây"}
          </p>
          {filteredConversations.map(renderConversation)}
          {filteredConversations.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm font-medium">
                {query
                  ? "Không tìm thấy cuộc trò chuyện khác"
                  : filter === "unread"
                    ? support?.unread_count
                      ? "Không có tin chưa đọc khác"
                      : "Bạn đã đọc hết tin nhắn"
                    : "Chưa có cuộc trò chuyện khác"}
              </p>
              <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                {query
                  ? "Thử tìm bằng tên cửa hàng hoặc nội dung tin nhắn."
                  : filter === "unread"
                    ? "Tin nhắn mới sẽ xuất hiện tại đây."
                    : "Nhắn tin từ trang sản phẩm để trò chuyện với cửa hàng."}
              </p>
            </div>
          ) : null}
        </div>
      </ScrollArea>
    </>
  )
}
