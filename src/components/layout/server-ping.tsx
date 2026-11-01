"use client"

import { useEffect, useState } from "react"
import { ActivityIcon } from "lucide-react"
import { apiFetch } from "@/api/client"

/** A tiny authenticated RTT probe; it never starts download/upload benchmarks. */
export function ServerPing({ active = true }: { active?: boolean }) {
  const [ping, setPing] = useState<number | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (!active) return
    let disposed = false
    let controller: AbortController | null = null
    const measure = async () => {
      if (document.visibilityState === "hidden") return
      controller?.abort()
      controller = new AbortController()
      const timeout = setTimeout(() => controller?.abort(), 5000)
      const startedAt = performance.now()
      try {
        await apiFetch({ path: "/diagnostics/ping", signal: controller.signal })
        if (!disposed) {
          setPing(Math.round(performance.now() - startedAt))
          setFailed(false)
        }
      } catch {
        if (!disposed) setFailed(true)
      } finally {
        clearTimeout(timeout)
      }
    }
    void measure()
    const timer = setInterval(() => void measure(), 30_000)
    return () => {
      disposed = true
      clearInterval(timer)
      controller?.abort()
    }
  }, [active])
  return (
    <span
      className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground"
      role="status"
    >
      <ActivityIcon className="size-3.5" />
      Ping máy chủ:{" "}
      {failed ? "Mất kết nối" : ping === null ? "Đang đo…" : `${ping} ms`}
    </span>
  )
}
