export const SESSION_CHANGED = "dealhay:session-changed"

let sessionId: string | null = null
let channel: BroadcastChannel | undefined

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
