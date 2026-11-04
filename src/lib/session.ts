export const ACCESS_TOKEN_STORAGE_KEY = "dealhay_access_token"
export const SESSION_CHANGED = "dealhay:session-changed"

function read(storage: "localStorage" | "sessionStorage", key: string) {
  try {
    return window[storage].getItem(key)
  } catch {
    return undefined
  }
}

function write(
  storage: "localStorage" | "sessionStorage",
  key: string,
  value: string
) {
  try {
    window[storage].setItem(key, value)
    return true
  } catch {
    return false
  }
}

function remove(storage: "localStorage" | "sessionStorage", key: string) {
  try {
    window[storage].removeItem(key)
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
}

function clearChatCredential() {
  // An empty shared record also stops older tabs restoring a retired credential.
  write("localStorage", "dealhay_wss_session", "")
  remove("sessionStorage", "dealhay_wss_session")
}

/** Remember the account across tabs and browser restarts; API validates expiry. */
export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null
  const remembered = read("localStorage", ACCESS_TOKEN_STORAGE_KEY)
  if (remembered !== undefined && remembered !== null) {
    remove("sessionStorage", ACCESS_TOKEN_STORAGE_KEY)
    return remembered || null
  }
  const previous = read("sessionStorage", ACCESS_TOKEN_STORAGE_KEY)
  if (!previous) return null
  if (
    remembered === null &&
    write("localStorage", ACCESS_TOKEN_STORAGE_KEY, previous)
  )
    remove("sessionStorage", ACCESS_TOKEN_STORAGE_KEY)
  return previous
}

export function saveAccessToken(token: string): void {
  if (typeof window === "undefined") return
  const previous = getAccessToken()
  const stored = write("localStorage", ACCESS_TOKEN_STORAGE_KEY, token)
  const remembered = read("localStorage", ACCESS_TOKEN_STORAGE_KEY)
  if (stored || remembered === token)
    remove("sessionStorage", ACCESS_TOKEN_STORAGE_KEY)
  else if (
    (remembered !== undefined && remembered !== null) ||
    !write("sessionStorage", ACCESS_TOKEN_STORAGE_KEY, token)
  )
    throw new Error("Trình duyệt không cho phép lưu phiên đăng nhập.")
  if (previous !== token) clearChatCredential()
  window.dispatchEvent(new Event(SESSION_CHANGED))
}

export function clearAccessToken(expectedToken?: string | null): void {
  if (typeof window === "undefined") return
  if (expectedToken !== undefined && getAccessToken() !== expectedToken) return
  // Keep a logout marker so a legacy sessionStorage token in another tab cannot
  // silently sign the browser back in after logout or a rejected credential.
  if (!write("localStorage", ACCESS_TOKEN_STORAGE_KEY, ""))
    remove("localStorage", ACCESS_TOKEN_STORAGE_KEY)
  remove("sessionStorage", ACCESS_TOKEN_STORAGE_KEY)
  clearChatCredential()
  window.dispatchEvent(new Event(SESSION_CHANGED))
}

/** Bridge browser storage changes to the existing account-change subscribers. */
export function watchStoredSession(): () => void {
  if (typeof window === "undefined") return () => {}
  let previous = getAccessToken()
  const remember = () => {
    previous = getAccessToken()
  }
  const sync = () => {
    const current = getAccessToken()
    if (current === previous) return
    previous = current
    remove("sessionStorage", "dealhay_wss_session")
    window.dispatchEvent(new Event(SESSION_CHANGED))
  }
  const storage = (event: StorageEvent) => {
    if (event.key === null || event.key === ACCESS_TOKEN_STORAGE_KEY) {
      if (event.key === null || event.newValue === null)
        remove("sessionStorage", ACCESS_TOKEN_STORAGE_KEY)
      sync()
    }
  }
  const visible = () => {
    if (document.visibilityState === "visible") sync()
  }
  window.addEventListener("storage", storage)
  window.addEventListener("focus", sync)
  window.addEventListener("pageshow", sync)
  window.addEventListener(SESSION_CHANGED, remember)
  if (typeof document !== "undefined")
    document.addEventListener("visibilitychange", visible)
  return () => {
    window.removeEventListener("storage", storage)
    window.removeEventListener("focus", sync)
    window.removeEventListener("pageshow", sync)
    window.removeEventListener(SESSION_CHANGED, remember)
    if (typeof document !== "undefined")
      document.removeEventListener("visibilitychange", visible)
  }
}
