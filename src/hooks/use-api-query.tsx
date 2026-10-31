"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ApiError } from "@/api/client"
import Loading from "@/components/layout/page-loading"
import NotFound from "@/components/layout/page-not-found"
import { Button } from "@/components/ui/button"
import { SESSION_CHANGED, getAccessToken } from "@/lib/session"
import { DATA_CHANGED, invalidateQueries } from "@/lib/query-cache"

/** The key includes every request parameter; disposed requests cannot replace newer data. */
export function useApiQuery<T>(key: string, load: () => Promise<T>) {
  const router = useRouter()
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState<{ key: string; data?: T; error?: Error }>({
    key,
  })
  useEffect(() => {
    const invalidate = () => setRevision((value) => value + 1)
    const changeSession = () => {
      setState({ key })
      invalidate()
    }
    window.addEventListener(DATA_CHANGED, invalidate)
    window.addEventListener(SESSION_CHANGED, changeSession)
    return () => {
      window.removeEventListener(DATA_CHANGED, invalidate)
      window.removeEventListener(SESSION_CHANGED, changeSession)
    }
  }, [key])
  useEffect(() => {
    let disposed = false
    const requestToken = getAccessToken()
    void load().then(
      (data) => {
        if (!disposed && requestToken === getAccessToken())
          setState({ key, data })
      },
      (error: Error) => {
        if (disposed || requestToken !== getAccessToken()) return
        if (error instanceof ApiError && error.status === 401) {
          router.replace(
            `/sign-in?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`
          )
        }
        setState({ key, error })
      }
    )
    return () => {
      disposed = true
    }
    // Request arguments are represented by key; callers pass an inline loader.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, revision, router])
  return state.key === key ? state : { key }
}

export function QueryPlaceholder({ error }: { error?: Error }) {
  if (!error) return <Loading />
  if (error instanceof ApiError && error.status === 404) return <NotFound />
  return (
    <div role="alert" className="space-y-4 rounded-xl border p-6 text-center">
      <p>
        {error instanceof ApiError
          ? error.message
          : "Không thể tải nội dung. Vui lòng thử lại."}
      </p>
      <Button onClick={invalidateQueries}>Thử tải lại</Button>
    </div>
  )
}
