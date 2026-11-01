"use client"

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import { usePathname, useRouter } from "next/navigation"
import { getCurrentSession } from "@/api/auth/queries"
import { getCachedChatSession } from "@/api/chats/session"
import Loading from "@/components/layout/page-loading"
import { getAuthPageHref, getSafeAuthRedirect } from "@/lib/auth-redirect"
import { DATA_CHANGED } from "@/lib/query-cache"
import { SESSION_CHANGED } from "@/lib/session"
import type { SessionResponse } from "@/api/auth/types"
import type { User } from "@/types/auth"

const guest: SessionResponse = {
  user: null,
  unreadCounts: { messages: 0, notifications: 0 },
}
function isRealtimePage(pathname: string): boolean {
  return (
    pathname === "/chats" ||
    pathname.startsWith("/chats/") ||
    pathname === "/diagnostics"
  )
}
const SessionContext = createContext<
  SessionResponse & { loading: boolean; offlineChat: boolean }
>({
  ...guest,
  loading: true,
  offlineChat: false,
})
export function SessionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const chatPage = isRealtimePage(pathname)
  const [session, setSession] = useState({
    ...guest,
    loading: true,
    offlineChat: false,
  })
  useEffect(() => {
    let disposed = false
    let revision = 0
    const load = () => {
      const request = ++revision
      let accountResolved = false
      if (chatPage)
        void getCachedChatSession()
          .catch(() => null)
          .then((fallback) => {
            if (
              fallback &&
              !accountResolved &&
              !disposed &&
              request === revision
            )
              setSession((previous) => ({
                ...fallback,
                unreadCounts: {
                  ...fallback.unreadCounts,
                  notifications: previous.unreadCounts.notifications,
                },
                loading: false,
                offlineChat: true,
              }))
          })
      void getCurrentSession()
        .then((data) => {
          accountResolved = true
          if (!disposed && request === revision)
            setSession({ ...data, loading: false, offlineChat: false })
        })
        .catch(async () => {
          const fallback = chatPage
            ? await getCachedChatSession().catch(() => null)
            : null
          if (!disposed && request === revision)
            setSession((previous) =>
              fallback
                ? {
                    ...fallback,
                    unreadCounts: {
                      ...fallback.unreadCounts,
                      notifications: previous.unreadCounts.notifications,
                    },
                    loading: false,
                    offlineChat: true,
                  }
                : { ...previous, loading: false }
            )
        })
    }
    const changeSession = () => {
      setSession({ ...guest, loading: true, offlineChat: false })
      load()
    }
    load()
    window.addEventListener(SESSION_CHANGED, changeSession)
    window.addEventListener(DATA_CHANGED, load)
    return () => {
      disposed = true
      window.removeEventListener(SESSION_CHANGED, changeSession)
      window.removeEventListener(DATA_CHANGED, load)
    }
  }, [chatPage])
  return (
    <SessionContext.Provider value={session}>
      {children}
    </SessionContext.Provider>
  )
}
export function useSession() {
  return useContext(SessionContext)
}
export function AuthGuard({
  children,
  admin = false,
  redirectTo,
}: {
  children: ReactNode | ((user: User) => ReactNode)
  admin?: boolean
  redirectTo?: string
}) {
  const { user, loading, offlineChat } = useSession()
  const pathname = usePathname()
  const chatPage = isRealtimePage(pathname)
  const allowedUser = offlineChat && (admin || !chatPage) ? null : user
  const router = useRouter()
  useEffect(() => {
    if (loading) return
    if (!allowedUser)
      router.replace(
        getAuthPageHref(
          "/sign-in",
          redirectTo ?? window.location.pathname + window.location.search
        )
      )
    else if (admin && allowedUser.role !== "administrator")
      router.replace("/forbidden")
  }, [allowedUser, loading, admin, redirectTo, router])
  if (
    loading ||
    !allowedUser ||
    (admin && allowedUser.role !== "administrator")
  )
    return <Loading />
  return typeof children === "function" ? children(allowedUser) : children
}

export function GuestGuard({
  children,
  redirectTo,
}: {
  children: ReactNode
  redirectTo?: string
}) {
  const { user, loading, offlineChat } = useSession()
  const router = useRouter()
  useEffect(() => {
    if (!loading && user && !offlineChat)
      router.replace(getSafeAuthRedirect(redirectTo))
  }, [loading, user, offlineChat, redirectTo, router])
  if (loading || (user && !offlineChat)) return <Loading />
  return children
}
