"use client"

import { useSyncExternalStore } from "react"

const query = "(width < 48rem)"
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
