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
  const [data, history] = await Promise.all([
    wssFetch<ChatsResponse>({ path: chatRoutes.list }),
    conversationSlug
      ? getChatHistory(conversationSlug, undefined, limit)
      : null,
  ])
  const conversation = data.conversations.find(
    ({ slug }) => slug === conversationSlug
  )
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
