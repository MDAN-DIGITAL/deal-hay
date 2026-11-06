"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ApiError } from "@/api/client"
import Loading from "@/components/layout/page-loading"
import NotFound from "@/components/layout/page-not-found"
import { Button } from "@/components/ui/button"
import { SESSION_CHANGED, getAccessToken } from "@/lib/session"
import { DATA_CHANGED, invalidateQueries } from "@/lib/query-cache"

const TRANSIENT_RETRY_DELAY_MS = 500

function isTransientQueryError(error: Error): boolean {
  return (
    error instanceof TypeError ||
    (error instanceof ApiError && error.status >= 500)
  )
}

/** The key includes every request parameter; disposed requests cannot replace newer data. */
export function useApiQuery<T>(
  key: string,
  load: () => Promise<T>,
  {
    initialData,
    initialError,
    revalidateOnMount = true,
    sessionSensitive = true,
  }: {
    initialData?: T
    initialError?: string
    revalidateOnMount?: boolean | "authenticated"
    sessionSensitive?: boolean
  } = {}
) {
  const router = useRouter()
  const [refresh, setRefresh] = useState({ key, revision: 0 })
  const revision = refresh.key === key ? refresh.revision : 0
  const [state, setState] = useState<{
    key: string
    data?: T
    error?: Error
    pending: boolean
  }>(() => ({
    key,
    data: initialData,
    error: initialError ? new Error(initialError) : undefined,
    // A browser request follows an unavailable server snapshot. Keep the
    // loading UI visible instead of flashing that transient server error.
    pending: initialData === undefined,
  }))
  useEffect(() => {
    const invalidate = () => {
      setState((current) =>
        current.key === key ? { ...current, pending: true } : current
      )
      setRefresh((value) => ({
        key,
        revision: value.key === key ? value.revision + 1 : 1,
      }))
    }
    const changeSession = () => {
      if (!sessionSensitive) return
      setState({ key, pending: true })
      invalidate()
    }
    window.addEventListener(DATA_CHANGED, invalidate)
    window.addEventListener(SESSION_CHANGED, changeSession)
    return () => {
      window.removeEventListener(DATA_CHANGED, invalidate)
      window.removeEventListener(SESSION_CHANGED, changeSession)
    }
  }, [key, sessionSensitive])
  useEffect(() => {
    if (
      initialData !== undefined &&
      revision === 0 &&
      (revalidateOnMount === false ||
        (revalidateOnMount === "authenticated" && !getAccessToken()))
    )
      return
    let disposed = false
    let retried = false
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    const requestToken = getAccessToken()
    const fail = (error: Error) => {
      if (disposed || requestToken !== getAccessToken()) return
      if (error instanceof ApiError && error.status === 401) {
        router.replace(
          `/sign-in?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`
        )
      }
      // A transient background personalization/refresh failure must not
      // discard a valid snapshot. Permanent 4xx responses still replace stale
      // data so deleted or newly forbidden resources are no longer rendered.
      setState((current) =>
        isTransientQueryError(error) &&
        current.key === key &&
        current.data !== undefined
          ? { ...current, error, pending: false }
          : { key, error, pending: false }
      )
    }
    const request = () => {
      if (disposed || requestToken !== getAccessToken()) return
      void load().then(
        (data) => {
          if (!disposed && requestToken === getAccessToken())
            setState({ key, data, pending: false })
        },
        (error: Error) => {
          if (
            !disposed &&
            requestToken === getAccessToken() &&
            !retried &&
            isTransientQueryError(error)
          ) {
            retried = true
            retryTimer = setTimeout(request, TRANSIENT_RETRY_DELAY_MS)
            return
          }
          fail(error)
        }
      )
    }
    request()
    return () => {
      disposed = true
      if (retryTimer !== undefined) clearTimeout(retryTimer)
    }
    // Request arguments are represented by key; callers pass an inline loader.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, revision, router])
  if (state.key !== key) {
    return { key, data: initialData, error: undefined }
  }

  return {
    key,
    data: state.data,
    error: state.pending ? undefined : state.error,
  }
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
