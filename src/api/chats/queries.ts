import { wssFetch } from "@/api/wss-client"
import { getWssSession } from "@/lib/wss-session"
import { chatRoutes } from "@/api/chats/routes"
import type {
  ChatHistoryResponse,
  ChatsResponse,
  RealtimeConfig,
} from "@/api/chats/types"

export async function getChats(
  conversationSlug?: string,
  limit?: number
): Promise<ChatsResponse> {
  const data = await wssFetch<ChatsResponse>({ path: chatRoutes.list })
  const cached = data.conversationSnapshots?.find(
    ({ slug }) => slug === conversationSlug
  )
  if (cached || !conversationSlug)
    return { ...data, selectedConversation: cached ?? null }
  const conversation = data.conversations.find(
    ({ slug }) => slug === conversationSlug
  )
  const history = conversation
    ? await getChatHistory(conversationSlug, undefined, limit)
    : null
  return {
    ...data,
    selectedConversation:
      conversation && history
        ? {
            ...conversation,
            messages: history.messages,
            messages_pagination: {
              has_more: history.has_more,
              next_cursor: history.next_cursor,
            },
          }
        : null,
  }
}

export function getChatHistory(
  conversationSlug: string,
  cursor?: string,
  limit?: number
): Promise<ChatHistoryResponse> {
  return wssFetch({
    path: chatRoutes.history(encodeURIComponent(conversationSlug)),
    searchParams: { cursor, limit },
  })
}

export async function getRealtimeConfig(): Promise<RealtimeConfig> {
  const session = await getWssSession()
  return {
    broadcaster: "socketio",
    url: session.url,
    heartbeat_interval_seconds: 30,
  }
}
