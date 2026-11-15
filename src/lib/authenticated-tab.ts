import type { MouseEvent } from "react"

import {
  ACCESS_TOKEN_SESSION_ONLY_KEY,
  ACCESS_TOKEN_STORAGE_KEY,
  getAccessToken,
} from "@/lib/session"

/** Carry temporary logins into an owned same-origin tab without remembering them. */
export function openAuthenticatedTab(event: MouseEvent<HTMLAnchorElement>) {
  if (
    event.defaultPrevented ||
    event.altKey ||
    event.shiftKey ||
    (event.button !== 0 && event.button !== 1)
  )
    return

  const destination = new URL(event.currentTarget.href, window.location.origin)
  if (destination.origin !== window.location.origin) return
  const account = getAccessToken()
  if (!account) return

  let page: Window | null = null
  try {
    page = window.open("about:blank", "_blank")
    if (!page) return
    page.opener = null
    page.sessionStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, account)
    page.sessionStorage.setItem(ACCESS_TOKEN_SESSION_ONLY_KEY, "1")
    page.location.replace(
      `${destination.pathname}${destination.search}${destination.hash}`
    )
    event.preventDefault()
  } catch {
    page?.close()
    // Keep the anchor's native new-tab behavior when scripting is unavailable.
  }
}
