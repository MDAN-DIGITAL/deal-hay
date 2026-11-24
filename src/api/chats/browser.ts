import { wssFetch } from "@/api/wss-client"
import { uploadChatFile } from "@/lib/chat-upload"
import { chatRoutes } from "@/api/chats/routes"
import type {
  ChatHistoryResponse,
  ChatsResponse,
  PresenceHeartbeatResponse,
} from "@/api/chats/types"
import type { ChatMessage } from "@/types/chat"
import type { SessionUser } from "@/types/auth"

export function startShopChat(
  shopCode: string,
  payload: { client_message_id?: string; product?: string; variant?: string }
): Promise<{ conversation: { id: string; slug: string }; replayed: boolean }> {
  return wssFetch({
    method: "POST",
    path: chatRoutes.startShop(shopCode),
    body: payload,
  })
}

export function startAdminChat(
  userId: string
): Promise<{ conversation: { id: string; slug: string } }> {
  return wssFetch({ method: "POST", path: chatRoutes.startAdmin(userId) })
}

export async function getUnreadMessageCount(): Promise<number | null> {
  const data = await wssFetch<{ messages: number } | SessionUser>({
    path: "/auth/me",
    searchParams: { view: "unread-messages" },
  })
  return "messages" in data
    ? data.messages
    : data.user
      ? data.unreadCounts.messages
      : null
}

type CompactChatsResponse = Pick<ChatsResponse, "conversations" | "admins"> & {
  messagesByConversation: Record<string, Omit<ChatMessage, "conversation_id">[]>
}

export async function getChats(): Promise<ChatsResponse> {
  const data = await wssFetch<ChatsResponse | CompactChatsResponse>({
    path: chatRoutes.list,
    searchParams: { view: "compact" },
  })
  if (!("messagesByConversation" in data)) return data

  const messages = new Map(Object.entries(data.messagesByConversation))
  return {
    conversations: data.conversations,
    admins: data.admins,
    selectedConversation: null,
    conversationSnapshots: data.conversations.map((conversation) => ({
      ...conversation,
      messages: (messages.get(conversation.id) ?? []).map((message) => ({
        ...message,
        conversation_id: conversation.id,
      })),
      messages_pagination: { has_more: false, next_cursor: null },
    })),
  }
}

export function getChatHistory(
  slug: string,
  cursor?: string,
  limit?: number
): Promise<ChatHistoryResponse> {
  return wssFetch({
    path: chatRoutes.history(encodeURIComponent(slug)),
    searchParams: { cursor, limit },
  })
}

export async function sendChatMessage(
  slug: string,
  body: FormData,
  idempotencyKey: string,
  socketId?: string,
  isCurrent?: () => boolean
): Promise<ChatMessage> {
  if (isCurrent && !isCurrent()) throw new Error("Phiên đăng nhập đã thay đổi.")
  const attachment = body.get("attachment")
  const reference =
    attachment instanceof File
      ? await uploadChatFile(attachment, isCurrent)
      : attachment
  return wssFetch(
    {
      path: chatRoutes.send(encodeURIComponent(slug)),
      method: "POST",
      signal: AbortSignal.timeout(30_000),
      body: {
        client_message_id: idempotencyKey,
        ...(body.get("body") ? { body: String(body.get("body")) } : {}),
        ...(body.get("reply_to_id")
          ? { reply_to_id: String(body.get("reply_to_id")) }
          : {}),
        ...(reference ? { attachment: String(reference) } : {}),
        ...(body.getAll("mention_admin_ids").length
          ? { mention_admin_ids: body.getAll("mention_admin_ids").map(String) }
          : {}),
      },
      headers: {
        "Idempotency-Key": idempotencyKey,
        ...(socketId ? { "X-Socket-ID": socketId } : {}),
      },
    },
    isCurrent
  )
}

export function markConversationRead(
  slug: string,
  socketId?: string
): Promise<{ ok: boolean }> {
  return wssFetch({
    path: chatRoutes.read(encodeURIComponent(slug)),
    method: "PATCH",
    headers: socketId ? { "X-Socket-ID": socketId } : undefined,
  })
}

export function recordPresenceHeartbeat(
  conversationId?: string
): Promise<PresenceHeartbeatResponse> {
  return wssFetch({
    path: chatRoutes.presence,
    method: "POST",
    body: { conversation_id: conversationId ?? null },
  })
}
