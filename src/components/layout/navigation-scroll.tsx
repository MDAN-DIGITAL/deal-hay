"use client"

import { useEffect, useRef } from "react"
import { usePathname, useSearchParams } from "next/navigation"

export function NavigationScroll() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const page = searchParams.get("page") || "1"
  const tab = searchParams.get("tab") || "overview"
  const destination = JSON.stringify([pathname, page, tab])
  const previous = useRef<string | null>(null)
  const restoredLocation = useRef<string | null>(null)

  useEffect(() => {
    const onPopState = () => {
      restoredLocation.current =
        window.location.pathname + window.location.search
    }
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  useEffect(() => {
    const initial = previous.current === null
    const changed = previous.current !== destination
    previous.current = destination
    const location = window.location.pathname + window.location.search
    const restored = restoredLocation.current === location
    restoredLocation.current = null

    // Keep browser history restoration, explicit anchors and chat positioning.
    if (
      initial ||
      !changed ||
      restored ||
      window.location.hash ||
      pathname === "/chats" ||
      pathname.startsWith("/chats/")
    )
      return

    const frame = window.requestAnimationFrame(() => {
      if (
        window.location.pathname + window.location.search !== location ||
        window.location.hash ||
        restoredLocation.current === location
      )
        return
      window.scrollTo({ top: 0, left: 0, behavior: "instant" })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [destination, pathname])

  return null
}
