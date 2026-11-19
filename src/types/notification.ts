export type AppNotification = {
  id: string
  title: string
  body: string
  category: string
  action_url: string | null
  sender?: { id: string; name: string; avatar_url: string | null } | null
  conversation_id?: string | null
  message_id?: string | null
  avatar_url?: string | null
  read_at: string | null
  created_at: string | null
}
