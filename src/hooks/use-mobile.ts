"use client"

import { useSyncExternalStore } from "react"

const MOBILE_BREAKPOINT = 768

const query = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`
function subscribe(change: () => void) {
  const media = window.matchMedia(query)
  media.addEventListener("change", change)
  return () => media.removeEventListener("change", change)
}
export function useIsMobile() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false
  )
}
