"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { getAccessToken } from "@/lib/session"
import { loadServerResources } from "@/modules/diagnostics/resource-actions"
import type { ServerResources } from "@/types/server-resources"
import type { SpeedtestTarget } from "@/types/speedtest"

type ResourceState = {
  data: ServerResources | null
  error: string | null
  loading: boolean
}
const initial = (): Record<SpeedtestTarget, ResourceState> => ({
  backend: { data: null, error: null, loading: true },
  wss: { data: null, error: null, loading: true },
})
const targets = ["backend", "wss"] as const

export function useServerResources() {
  const [states, setStates] = useState(initial)
  const requests = useRef(new Map<SpeedtestTarget, AbortController>())
  const mounted = useRef(false)
  const refresh = useCallback(() => {
    if (!mounted.current) return
    for (const target of targets) {
      if (requests.current.has(target)) continue
      const controller = new AbortController()
      const account = getAccessToken()
      requests.current.set(target, controller)
      const timeout = setTimeout(() => controller.abort(), 10_000)
      const current = () =>
        mounted.current &&
        requests.current.get(target) === controller &&
        getAccessToken() === account
      setStates((previous) => ({
        ...previous,
        [target]: { ...previous[target], loading: true },
      }))
      void loadServerResources(target, controller.signal)
        .then(
          (data) => {
            if (current() && !controller.signal.aborted)
              setStates((previous) => ({
                ...previous,
                [target]: { data, error: null, loading: false },
              }))
          },
          (error: unknown) => {
            if (current())
              setStates((previous) => ({
                ...previous,
                [target]: {
                  ...previous[target],
                  loading: false,
                  error: controller.signal.aborted
                    ? "Máy chủ không trả lời trong 10 giây."
                    : error instanceof Error
                      ? error.message
                      : "Không lấy được số liệu tài nguyên.",
                },
              }))
          }
        )
        .finally(() => {
          clearTimeout(timeout)
          if (requests.current.get(target) === controller)
            requests.current.delete(target)
        })
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    refresh()
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh()
    }
    const interval = setInterval(onVisible, 5_000)
    document.addEventListener("visibilitychange", onVisible)
    const activeRequests = requests.current
    return () => {
      mounted.current = false
      clearInterval(interval)
      document.removeEventListener("visibilitychange", onVisible)
      for (const controller of activeRequests.values()) controller.abort()
      activeRequests.clear()
    }
  }, [refresh])

  return {
    states,
    refresh,
    loading: targets.some((target) => states[target].loading),
  }
}
