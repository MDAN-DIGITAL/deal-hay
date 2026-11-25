import { apiFetch, ApiError } from "@/api/client"
import { authRoutes } from "@/api/auth/routes"
import { getSessionId } from "@/lib/session"
import type { SessionResponse, MeResponse } from "@/api/auth/types"

type CurrentSession = SessionResponse & { session: string | null }

let pendingCurrentSession:
  | { owner: string | null; request: Promise<CurrentSession> }
  | undefined

async function readCurrentSession(): Promise<CurrentSession> {
  const guestSession = {
    user: null,
    unreadCounts: { messages: 0, notifications: 0 },
    session: null,
  }

  try {
    const response = await apiFetch<MeResponse>({
      path: authRoutes.me,
      searchParams: { view: "identity" },
    })
    return {
      user: response.data,
      session: response.session,
      unreadCounts: guestSession.unreadCounts,
    }
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return guestSession
    }
    throw error
  }
}

/** Collapse simultaneous focus/page-show/account requests into one API call. */
export function getCurrentSession(): Promise<CurrentSession> {
  const owner = getSessionId()
  if (pendingCurrentSession?.owner === owner)
    return pendingCurrentSession.request
  const request = readCurrentSession().finally(() => {
    if (pendingCurrentSession?.request === request)
      pendingCurrentSession = undefined
  })
  pendingCurrentSession = { owner, request }
  return request
}
