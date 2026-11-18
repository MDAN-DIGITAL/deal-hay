import { apiFetch, ApiError } from "@/api/client"
import { authRoutes } from "@/api/auth/routes"
import type { SessionResponse, MeResponse } from "@/api/auth/types"

export async function getCurrentSession(): Promise<
  SessionResponse & { session: string | null }
> {
  const guestSession = {
    user: null,
    unreadCounts: { messages: 0, notifications: 0 },
    session: null,
  }

  try {
    const response = await apiFetch<MeResponse>({ path: authRoutes.me })
    return {
      user: response.data,
      session: response.session,
      unreadCounts: {
        messages: response.meta.unread_messages_count,
        notifications: response.meta.unread_notifications_count,
      },
    }
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return guestSession
    }
    throw error
  }
}
