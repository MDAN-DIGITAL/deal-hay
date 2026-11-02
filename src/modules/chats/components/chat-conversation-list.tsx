"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { MessageCircleIcon, SearchIcon, ShieldCheckIcon } from "lucide-react"

import { EmptyState } from "@/components/layout/empty-state"
import { Badge } from "@/components/ui/badge"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { ScrollArea } from "@/components/ui/scroll-area"
import { UserAvatar } from "@/components/user-avatar"
import type { ConversationSummary } from "@/types/chat"

export function ChatConversationList({
  conversations,
  selectedConversationId,
  onSelect,
}: {
  conversations: ConversationSummary[]
  selectedConversationId?: string
  onSelect: (slug: string) => void
}) {
  const [query, setQuery] = useState("")
  const support = conversations.find((conversation) => conversation.is_support)
  const filteredConversations = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("vi")
    return conversations.filter(
      (conversation) =>
        !conversation.is_support &&
        (!normalized ||
          `${conversation.counterpart.name} ${conversation.last_message ?? ""}`
            .toLocaleLowerCase("vi")
            .includes(normalized))
    )
  }, [conversations, query])
  const visibleConversations = support
    ? [support, ...filteredConversations]
    : filteredConversations

  return (
    <>
      <div className="space-y-3 border-b p-4">
        <div className="flex items-center gap-2 font-heading font-medium">
          <MessageCircleIcon className="size-5 text-primary" />
          Cuộc trò chuyện
          <Badge className="ml-auto" variant="secondary">
            {conversations.length + (support ? 0 : 1)}
          </Badge>
        </div>
        <InputGroup className="h-11">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            aria-label="Tìm cuộc trò chuyện"
            className="h-11 text-base md:text-base"
            placeholder="Tìm theo tên hoặc tin nhắn..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </InputGroup>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-1 p-2">
          {!support ? (
            <Item className="rounded-xl bg-primary/5" aria-disabled="true">
              <ItemMedia>
                <UserAvatar name="Deal Hay Admin" size="lg" src={null} />
              </ItemMedia>
              <ItemContent className="min-w-0">
                <ItemTitle className="text-base">Deal Hay Admin</ItemTitle>
                <ItemDescription className="line-clamp-1">
                  Bộ phận hỗ trợ chưa sẵn sàng
                </ItemDescription>
              </ItemContent>
              <ShieldCheckIcon
                aria-label="Hỗ trợ chính thức"
                className="size-5 shrink-0 text-primary"
              />
            </Item>
          ) : null}
          {visibleConversations.map((conversation) => {
            const selected = selectedConversationId === conversation.id
            const isSupport = conversation.is_support
            return (
              <Item
                key={conversation.id}
                className={isSupport ? "rounded-xl bg-primary/5" : "rounded-xl"}
                render={
                  <Link
                    href={`/chats/${conversation.slug}`}
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
                  />
                }
                variant={selected ? "muted" : "default"}
              >
                <ItemMedia>
                  <div className="relative">
                    <UserAvatar
                      name={conversation.counterpart.name}
                      size="lg"
                      src={conversation.counterpart.avatar_url}
                    />
                    <span
                      aria-label={
                        conversation.counterpart.is_online
                          ? "Đang trực tuyến"
                          : "Đang ngoại tuyến"
                      }
                      className={`absolute right-0 bottom-0 size-2.5 rounded-full border-2 border-card ${
                        conversation.counterpart.is_online
                          ? "bg-emerald-500"
                          : "bg-muted-foreground/40"
                      }`}
                    />
                  </div>
                </ItemMedia>
                <ItemContent className="min-w-0">
                  <ItemTitle className="text-base">
                    {isSupport
                      ? "Deal Hay Admin"
                      : conversation.counterpart.name}
                    {isSupport ? (
                      <ShieldCheckIcon
                        aria-label="Hỗ trợ chính thức"
                        className="size-4 shrink-0 text-primary"
                      />
                    ) : null}
                  </ItemTitle>
                  <ItemDescription className="line-clamp-1">
                    {conversation.last_message ??
                      (isSupport
                        ? "Nhắn tin để được hỗ trợ"
                        : "Bắt đầu cuộc trò chuyện")}
                  </ItemDescription>
                </ItemContent>
                {conversation.unread_count > 0 ? (
                  <Badge>{Math.min(conversation.unread_count, 99)}</Badge>
                ) : null}
              </Item>
            )
          })}

          {filteredConversations.length === 0 ? (
            <div className="p-3">
              <EmptyState
                title={
                  query
                    ? "Không tìm thấy cuộc trò chuyện"
                    : "Chưa có cuộc trò chuyện khác"
                }
                description={
                  query
                    ? "Hãy thử một tên hoặc nội dung khác."
                    : "Hãy mở một sản phẩm và nhắn tin cho cửa hàng để bắt đầu."
                }
              />
            </div>
          ) : null}
        </div>
      </ScrollArea>
    </>
  )
}
