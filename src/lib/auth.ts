import {
  announceSession,
  clearAuthSessionHint,
  getSessionId,
  hasAuthSessionHint,
  setAuthSessionHint,
} from "@/lib/session"

export function setAuthSession(id: string, persistent?: boolean): void {
  if (persistent !== undefined || !hasAuthSessionHint())
    setAuthSessionHint(persistent)
  announceSession(id)
}

export function clearAuthSession(expectedSession = getSessionId()): void {
  if (getSessionId() === expectedSession) {
    clearAuthSessionHint()
    announceSession(null)
  }
}
