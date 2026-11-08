export const ACCESS_TOKEN_STORAGE_KEY = "dealhay_access_token"
export const ACCESS_TOKEN_SESSION_ONLY_KEY = "dealhay_access_token_session_only"
export const SESSION_CHANGED = "dealhay:session-changed"

type BrowserStorage = "localStorage" | "sessionStorage"

function read(storage: BrowserStorage, key: string) {
  try {
    return window[storage].getItem(key)
  } catch {
    return undefined
  }
}

function write(storage: BrowserStorage, key: string, value: string) {
  try {
    window[storage].setItem(key, value)
    return true
  } catch {
    return false
  }
}

function remove(storage: BrowserStorage, key: string) {
  try {
    window[storage].removeItem(key)
    return true
  } catch {
    // Storage can be unavailable in restricted browser contexts.
    return false
  }
}

function clearTabToken() {
  remove("sessionStorage", ACCESS_TOKEN_STORAGE_KEY)
  remove("sessionStorage", ACCESS_TOKEN_SESSION_ONLY_KEY)
}

function hasExplicitTabToken(): boolean {
  return read("sessionStorage", ACCESS_TOKEN_SESSION_ONLY_KEY) === "1"
}

function saveTabToken(token: string): boolean {
  if (
    !write("sessionStorage", ACCESS_TOKEN_SESSION_ONLY_KEY, "1") ||
    !write("sessionStorage", ACCESS_TOKEN_STORAGE_KEY, token) ||
    read("sessionStorage", ACCESS_TOKEN_SESSION_ONLY_KEY) !== "1" ||
    read("sessionStorage", ACCESS_TOKEN_STORAGE_KEY) !== token
  ) {
    clearTabToken()
    return false
  }

  return true
}

function clearChatCredential() {
  // An empty shared record also stops older tabs restoring a retired credential.
  write("localStorage", "dealhay_wss_session", "")
  remove("sessionStorage", "dealhay_wss_session")
}

/** Read the remembered account first, then this tab's temporary account. */
export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null
  const remembered = read("localStorage", ACCESS_TOKEN_STORAGE_KEY)
  if (remembered !== undefined && remembered !== null) {
    clearTabToken()
    return remembered || null
  }
  const previous = read("sessionStorage", ACCESS_TOKEN_STORAGE_KEY)
  if (!previous) {
    remove("sessionStorage", ACCESS_TOKEN_SESSION_ONLY_KEY)
    return null
  }
  if (hasExplicitTabToken()) return previous

  // Migrate only tokens created before the remember-login choice existed.
  // New temporary sessions carry the marker above and must remain tab-scoped.
  if (
    remembered === null &&
    write("localStorage", ACCESS_TOKEN_STORAGE_KEY, previous) &&
    read("localStorage", ACCESS_TOKEN_STORAGE_KEY) === previous
  )
    clearTabToken()
  return previous
}

export function saveAccessToken(token: string, remember = true): void {
  if (typeof window === "undefined") return
  const previous = getAccessToken()

  if (remember) {
    write("localStorage", ACCESS_TOKEN_STORAGE_KEY, token)
    const persisted = read("localStorage", ACCESS_TOKEN_STORAGE_KEY)
    if (persisted === token) clearTabToken()
    else if (
      (persisted !== undefined && persisted !== null) ||
      !saveTabToken(token)
    )
      throw new Error("Trình duyệt không cho phép lưu phiên đăng nhập.")
  } else {
    if (!saveTabToken(token))
      throw new Error("Trình duyệt không cho phép lưu phiên đăng nhập.")
    remove("localStorage", ACCESS_TOKEN_STORAGE_KEY)
    const persisted = read("localStorage", ACCESS_TOKEN_STORAGE_KEY)
    if (persisted !== undefined && persisted !== null) {
      clearTabToken()
      throw new Error("Trình duyệt không cho phép lưu phiên đăng nhập.")
    }
  }

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
  clearTabToken()
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
      if (
        event.key === null ||
        (event.newValue === null && !hasExplicitTabToken())
      )
        clearTabToken()
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
