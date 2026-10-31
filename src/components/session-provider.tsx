"use client"

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import { useRouter } from "next/navigation"
import { getCurrentSession } from "@/api/auth/queries"
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
const SessionContext = createContext<SessionResponse & { loading: boolean }>({
  ...guest,
  loading: true,
})
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState({ ...guest, loading: true })
  useEffect(() => {
    let disposed = false
    let revision = 0
    const load = () => {
      const request = ++revision
      void getCurrentSession()
        .then((data) => {
          if (!disposed && request === revision)
            setSession({ ...data, loading: false })
        })
        .catch(() => {
          if (!disposed && request === revision)
            setSession((previous) => ({ ...previous, loading: false }))
        })
    }
    const changeSession = () => {
      setSession({ ...guest, loading: true })
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
  }, [])
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
  const { user, loading } = useSession()
  const router = useRouter()
  useEffect(() => {
    if (loading) return
    if (!user)
      router.replace(
        getAuthPageHref(
          "/sign-in",
          redirectTo ?? window.location.pathname + window.location.search
        )
      )
    else if (admin && user.role !== "administrator")
      router.replace("/forbidden")
  }, [user, loading, admin, redirectTo, router])
  if (loading || !user || (admin && user.role !== "administrator"))
    return <Loading />
  return typeof children === "function" ? children(user) : children
}

export function GuestGuard({
  children,
  redirectTo,
}: {
  children: ReactNode
  redirectTo?: string
}) {
  const { user, loading } = useSession()
  const router = useRouter()
  useEffect(() => {
    if (!loading && user) router.replace(getSafeAuthRedirect(redirectTo))
  }, [loading, user, redirectTo, router])
  if (loading || user) return <Loading />
  return children
}
