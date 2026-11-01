import { wssFetch } from "@/api/wss-client"
import { cachedWssSession } from "@/lib/wss-session"
import type { SessionResponse } from "@/api/auth/types"
import type { User } from "@/types/auth"

/** Use a server-validated WSS identity only for chat and diagnostics during an API outage. */
export async function getCachedChatSession(): Promise<SessionResponse | null> {
  if (!(await cachedWssSession())) return null
  const session = await wssFetch<{
    user:
      | (Partial<User> & Pick<User, "id" | "full_name" | "role" | "is_active">)
      | null
    unreadCounts: SessionResponse["unreadCounts"]
  }>({ path: "/auth/me" })
  const profile = session.user
  if (
    !profile ||
    typeof profile.id !== "string" ||
    (profile.is_active !== true && profile.is_active !== 1) ||
    typeof profile.full_name !== "string"
  )
    return null
  const user: User = {
    user_code: profile.id,
    shop_name: null,
    email: "",
    shop_email: null,
    phone_number: null,
    shop_phone_number: null,
    shop_avatar_url: null,
    shop_province: null,
    shop_ward: null,
    shop_address_detail: null,
    province: null,
    ward: null,
    address_detail: null,
    avatar_url: null,
    lock_reason: null,
    email_verified_at: null,
    created_at: null,
    updated_at: null,
    ...profile,
  }
  return {
    user,
    unreadCounts: { messages: session.unreadCounts.messages, notifications: 0 },
  }
}
