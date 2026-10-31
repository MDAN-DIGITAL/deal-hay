"use client"

import { useEffect, useRef, useState } from "react"
import { startSpeedtestAction } from "@/modules/diagnostics/speedtest-actions"
import {
  initialSpeedtestState,
  measureSpeedtest,
} from "@/modules/diagnostics/lib/speedtest"
import type { SpeedtestState, SpeedtestTarget } from "@/types/speedtest"

const targets = ["backend", "wss"] as const

function initialStates(): Record<SpeedtestTarget, SpeedtestState> {
  return { backend: initialSpeedtestState(), wss: initialSpeedtestState() }
}

export function useSpeedtest() {
  const [states, setStates] = useState(initialStates)
  const active = useRef<AbortController | null>(null)
  const mounted = useRef(true)
  const [activeTarget, setActiveTarget] = useState<SpeedtestTarget | null>(null)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      active.current?.abort()
      active.current = null
    }
  }, [])

  function start() {
    if (active.current || !mounted.current) return
    const controller = new AbortController()
    active.current = controller
    const current = () =>
      mounted.current &&
      active.current === controller &&
      !controller.signal.aborted
    setStates(initialStates())
    setActiveTarget("backend")
    void (async () => {
      try {
        // Run separately so the two transfers do not compete for bandwidth.
        for (const target of targets) {
          if (!current()) return
          const startedAt = performance.now()
          const serverName =
            target === "backend" ? "DealHay Backend" : "DealHay WSS"
          setActiveTarget(target)
          setStates((previous) => ({
            ...previous,
            [target]: {
              ...initialSpeedtestState(),
              phase: "connecting",
              serverName,
            },
          }))
          try {
            // Mint each grant immediately before its server is measured.
            const session = await startSpeedtestAction(target)
            if (!current()) return
            if (!session.success) throw new Error(session.message)
            const setupMs = performance.now() - startedAt
            const update = (next: SpeedtestState) => {
              if (current())
                setStates((previous) => ({
                  ...previous,
                  [target]: {
                    ...next,
                    serverName,
                    elapsedMs: next.elapsedMs + setupMs,
                  },
                }))
            }
            update(
              await measureSpeedtest(session.data, controller.signal, update)
            )
          } catch (error) {
            if (current())
              setStates((previous) => ({
                ...previous,
                [target]: {
                  ...previous[target],
                  phase: "error",
                  liveMbps: null,
                  error:
                    error instanceof Error
                      ? error.message
                      : "Không thể đo kết nối. Vui lòng thử lại.",
                  elapsedMs: performance.now() - startedAt,
                },
              }))
          }
        }
      } finally {
        if (active.current === controller) {
          active.current = null
          if (mounted.current) setActiveTarget(null)
        }
      }
    })()
  }

  function cancel() {
    if (!active.current) return
    active.current.abort()
    active.current = null
    setActiveTarget(null)
    const cancelled = (state: SpeedtestState): SpeedtestState =>
      ["complete", "error"].includes(state.phase)
        ? state
        : { ...state, phase: "cancelled", error: null, liveMbps: null }
    setStates((previous) => ({
      backend: cancelled(previous.backend),
      wss: cancelled(previous.wss),
    }))
  }

  return {
    states,
    activeTarget,
    start,
    cancel,
    running: activeTarget !== null,
  }
}
