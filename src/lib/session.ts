const TOKEN_KEY = "dealhay_access_token"
export const SESSION_CHANGED = "dealhay:session-changed"

/** Tab-scoped token. The API remains the authority for identity and permissions. */
export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null
  return window.sessionStorage.getItem(TOKEN_KEY)
}
export function saveAccessToken(token: string): void {
  if (getAccessToken() !== token)
    window.sessionStorage.removeItem("dealhay_wss_session")
  window.sessionStorage.setItem(TOKEN_KEY, token)
  window.dispatchEvent(new Event(SESSION_CHANGED))
}
export function clearAccessToken(): void {
  if (typeof window === "undefined") return
  window.sessionStorage.removeItem(TOKEN_KEY)
  window.sessionStorage.removeItem("dealhay_wss_session")
  window.dispatchEvent(new Event(SESSION_CHANGED))
}
