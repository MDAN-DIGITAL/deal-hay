"use client"

import { useEffect, useMemo, useState } from "react"
import type { RealtimeClient } from "@/lib/realtime-client"
import type { ConnectionStatus } from "@/lib/realtime-client"

type RealtimeSession = {
  echo: RealtimeClient | null
  status: ConnectionStatus
  socketId?: string
}

type LatencySample = {
  session: RealtimeSession
  milliseconds: number | null
  timedOut: boolean
}

export function useRealtimeLatency({
  echo,
  status,
  socketId,
}: RealtimeSession) {
  const [sample, setSample] = useState<LatencySample | null>(null)
  const session = useMemo(
    () => ({ echo, status, socketId }),
    [echo, status, socketId]
  )

  useEffect(() => {
    const { echo, status, socketId } = session
    if (!echo || status !== "connected" || !socketId) return

    {
      let disposed = false
      let probing = false
      const probe = async () => {
        if (disposed || probing || document.visibilityState !== "visible")
          return
        probing = true
        const started = performance.now()
        try {
          await echo.ping()
          if (!disposed)
            setSample({
              session,
              milliseconds: Math.max(
                0,
                Math.round(performance.now() - started)
              ),
              timedOut: false,
            })
        } catch {
          if (!disposed)
            setSample({ session, milliseconds: null, timedOut: true })
        } finally {
          probing = false
        }
      }
      const initial = window.setTimeout(() => void probe(), 0)
      const interval = window.setInterval(() => void probe(), 15_000)
      return () => {
        disposed = true
        window.clearTimeout(initial)
        window.clearInterval(interval)
      }
    }
  }, [session])

  const currentSample =
    status === "connected" && sample?.session === session ? sample : null

  return {
    latencyMs: currentSample?.milliseconds ?? null,
    pingTimedOut: currentSample?.timedOut ?? false,
  }
}
