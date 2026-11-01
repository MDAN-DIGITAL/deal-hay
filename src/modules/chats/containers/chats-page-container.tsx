"use client"

import { useApiQuery, QueryPlaceholder } from "@/hooks/use-api-query"
import { getChats } from "@/api/chats/queries"
import { ChatsPageClient } from "@/modules/chats/components/chats-page-client"

export function ChatsPageContainer({
  conversationSlug,
  currentUserId,
}: {
  conversationSlug?: string
  currentUserId: string
}) {
  const { data: data, error } = useApiQuery(
    JSON.stringify(["chats", currentUserId]),
    () => getChats(conversationSlug, 50)
  )
  if (!data) return <QueryPlaceholder error={error} />

  return (
    <ChatsPageClient
      key={currentUserId}
      admins={data.admins}
      conversationSnapshots={data.conversationSnapshots}
      conversations={data.conversations}
      currentUserId={currentUserId}
      selectedConversation={data.selectedConversation}
    />
  )
}
