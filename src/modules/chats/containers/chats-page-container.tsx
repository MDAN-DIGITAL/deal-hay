"use client"

import { useApiQuery, QueryPlaceholder } from "@/hooks/use-api-query"
import { getChats } from "@/api/chats/queries"
import { ChatsPageClient } from "@/modules/chats/components/chats-page-client"

export function ChatsPageContainer({
  conversationSlug,
  currentUserId,
  embedded = false,
  active = true,
  onConversationChange,
}: {
  conversationSlug?: string
  currentUserId: string
  embedded?: boolean
  active?: boolean
  onConversationChange?: (slug?: string) => void
}) {
  const { data: data, error } = useApiQuery(
    JSON.stringify(["chats", currentUserId]),
    () => getChats(conversationSlug, 50)
  )
  if (!data)
    return (
      <div
        className={embedded ? "min-h-0 flex-1 overflow-y-auto p-4" : undefined}
      >
        {embedded && !error ? (
          <p
            className="py-12 text-center text-sm text-muted-foreground"
            role="status"
          >
            Đang tải cuộc trò chuyện...
          </p>
        ) : (
          <QueryPlaceholder error={error} />
        )}
      </div>
    )

  return (
    <ChatsPageClient
      key={currentUserId}
      active={active}
      embedded={embedded}
      onConversationChange={onConversationChange}
      admins={data.admins}
      conversationSnapshots={data.conversationSnapshots}
      conversations={data.conversations}
      currentUserId={currentUserId}
      selectedConversation={data.selectedConversation}
    />
  )
}
