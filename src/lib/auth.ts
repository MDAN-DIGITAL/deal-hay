import { announceSession, getSessionId } from "@/lib/session"

export function setAuthSession(id: string): void {
  announceSession(id)
}

export function clearAuthSession(expectedSession = getSessionId()): void {
  if (getSessionId() === expectedSession) announceSession(null)
}
