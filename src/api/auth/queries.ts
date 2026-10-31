import { getAccessToken } from "@/lib/session"

import { apiFetch, ApiError } from "@/api/client"
import { authRoutes } from "@/api/auth/routes"
import type { SessionResponse, MeResponse } from "@/api/auth/types"

export async function getCurrentSession(): Promise<SessionResponse> {
  const token = getAccessToken()
  const guestSession: SessionResponse = {
    user: null,
    unreadCounts: { messages: 0, notifications: 0 },
  }

  if (!token) return guestSession

  try {
    const response = await apiFetch<MeResponse>({ path: authRoutes.me, token })
    return {
      user: response.data,
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
