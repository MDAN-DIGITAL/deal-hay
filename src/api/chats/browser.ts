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

export async function getCurrentSession(): Promise<SessionUser> {
  return wssFetch<SessionUser>({ path: "/auth/me" })
}

export function getChats(): Promise<ChatsResponse> {
  return wssFetch({ path: chatRoutes.list })
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
  socketId?: string
): Promise<ChatMessage> {
  const attachment = body.get("attachment")
  const reference =
    attachment instanceof File ? await uploadChatFile(attachment) : attachment
  return wssFetch({
    path: chatRoutes.send(encodeURIComponent(slug)),
    method: "POST",
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
  })
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
