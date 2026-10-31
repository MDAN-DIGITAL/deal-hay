import type {
  ConversationSummary,
  SelectedConversation,
  ChatMessage,
} from "@/types/chat"

export type ChatsResponse = {
  conversations: ConversationSummary[]
  selectedConversation: SelectedConversation | null
}

export type ChatHistoryResponse = {
  messages: ChatMessage[]
  has_more: boolean
  next_cursor: string | null
}

export type SocketRealtimeConfig = {
  broadcaster: "socketio"
  url: string
  heartbeat_interval_seconds: number
}
export type RealtimeConfig = SocketRealtimeConfig

export type PresenceHeartbeatResponse = {
  ok: boolean
  expires_in: number
  server_time: string
}

export type ChatMessagesReadEvent = {
  conversation_id: string
  reader_id: string
  message_ids: string[]
  read_at: string
  read_through_at: string
}
