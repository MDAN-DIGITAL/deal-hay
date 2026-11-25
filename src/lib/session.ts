export const SESSION_CHANGED = "dealhay:session-changed"
export const AUTH_SESSION_HINT = "dealhay-session-present"

const PERSISTENT_SESSION_SECONDS = 30 * 24 * 60 * 60

let sessionId: string | null = null
let channel: BroadcastChannel | undefined

function secureCookieAttribute(): string {
  return typeof window !== "undefined" && window.location.protocol === "https:"
    ? "; Secure"
    : ""
}

/**
 * This cookie contains no credential. It only avoids probing the authenticated
 * endpoint for browsers that have never established a Deal Hay session.
 */
export function hasAuthSessionHint(): boolean {
  if (typeof document === "undefined") return false
  return document.cookie
    .split(";")
    .some((cookie) => cookie.trim() === `${AUTH_SESSION_HINT}=1`)
}

export function setAuthSessionHint(persistent = false): void {
  if (typeof document === "undefined") return
  const lifetime = persistent ? `; Max-Age=${PERSISTENT_SESSION_SECONDS}` : ""
  document.cookie = `${AUTH_SESSION_HINT}=1; Path=/; SameSite=Lax${lifetime}${secureCookieAttribute()}`
}

export function clearAuthSessionHint(): void {
  if (typeof document === "undefined") return
  document.cookie = `${AUTH_SESSION_HINT}=; Path=/; SameSite=Lax; Max-Age=0${secureCookieAttribute()}`
}

/** Identifies the current UI session. The API authenticates via its HttpOnly cookie. */
export function getSessionId(): string | null {
  return sessionId
}

export function setSessionId(id: string | null): void {
  sessionId = id
}

export function announceSession(id: string | null): void {
  setSessionId(id)
  if (typeof window === "undefined") return
  channel?.postMessage(null)
  window.dispatchEvent(new Event(SESSION_CHANGED))
}

export function watchBrowserSession(): () => void {
  if (typeof window === "undefined") return () => {}

  if (typeof BroadcastChannel === "undefined") return () => {}
  const connection = new BroadcastChannel(SESSION_CHANGED)
  channel = connection
  connection.onmessage = () => {
    setSessionId(null)
    window.dispatchEvent(new Event(SESSION_CHANGED))
  }
  return () => {
    connection.close()
    if (channel === connection) channel = undefined
  }
}
