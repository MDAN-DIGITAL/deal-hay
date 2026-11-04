import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

const source = ts.transpileModule(
  readFileSync(new URL("../src/lib/session.ts", import.meta.url), "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }
).outputText
let revision = 0
const loadSession = () =>
  import(
    `data:text/javascript;base64,${Buffer.from(`${source}\n// fixture ${++revision}`).toString("base64")}`
  )
const tokenKey = "dealhay_access_token"
const wssKey = "dealhay_wss_session"

function storage(values = {}, options = {}) {
  const entries =
    values instanceof Map ? values : new Map(Object.entries(values))
  return {
    getItem(key) {
      if (options.readBlocked)
        throw new DOMException("Blocked", "SecurityError")
      return entries.get(key) ?? null
    },
    setItem(key, value) {
      if (options.writeBlocked)
        throw new DOMException("Blocked", "QuotaExceededError")
      entries.set(key, String(value))
    },
    removeItem(key) {
      if (options.writeBlocked)
        throw new DOMException("Blocked", "QuotaExceededError")
      entries.delete(key)
    },
    clear() {
      entries.clear()
    },
  }
}

function page(shared = new Map(), session = {}, localOptions = {}) {
  const window = Object.assign(new EventTarget(), {
    localStorage: storage(shared, localOptions),
    sessionStorage: storage(session),
    location: new URL("https://dealhay.example/chats/support"),
  })
  const document = Object.assign(new EventTarget(), {
    visibilityState: "visible",
  })
  return { window, document }
}

function activate(t, target) {
  t.mock.property(globalThis, "window", target.window)
  t.mock.property(globalThis, "document", target.document)
  return target
}

Object.defineProperties(globalThis, {
  window: { value: undefined, writable: true, configurable: true },
  document: { value: undefined, writable: true, configurable: true },
})

function storageChanged(
  target,
  key = tokenKey,
  area = target.window.localStorage
) {
  const event = new Event("storage")
  Object.defineProperties(event, {
    key: { value: key },
    storageArea: { value: area },
    newValue: { value: key === null ? null : area.getItem(key) },
    oldValue: { value: null },
  })
  target.window.dispatchEvent(event)
}

test("server rendering reads no account and does not access browser storage", async () => {
  const session = await loadSession()
  assert.equal(session.getAccessToken(), null)
})

test("remembered login is available to a fresh native tab and a reopened browser", async (t) => {
  const shared = new Map()
  const first = activate(t, page(shared))
  const session = await loadSession()
  session.saveAccessToken("account-a")
  assert.equal(first.window.localStorage.getItem(tokenKey), "account-a")
  for (const reopened of [page(shared), page(shared)]) {
    globalThis.window = reopened.window
    globalThis.document = reopened.document
    assert.equal(reopened.window.sessionStorage.getItem(tokenKey), null)
    assert.equal((await loadSession()).getAccessToken(), "account-a")
  }
})

test("an existing tab login migrates once without requiring another sign-in", async (t) => {
  const current = activate(t, page(new Map(), { [tokenKey]: "legacy-account" }))
  const session = await loadSession()
  assert.equal(session.getAccessToken(), "legacy-account")
  assert.equal(current.window.localStorage.getItem(tokenKey), "legacy-account")
  assert.equal(current.window.sessionStorage.getItem(tokenKey), null)
})

test("canonical account changes and logout override stale credentials in another tab", async (t) => {
  const shared = new Map([[tokenKey, "account-b"]])
  const current = activate(t, page(shared, { [tokenKey]: "account-a" }))
  const session = await loadSession()
  assert.equal(session.getAccessToken(), "account-b")
  shared.set(tokenKey, "")
  current.window.sessionStorage.setItem(tokenKey, "account-a")
  assert.equal(session.getAccessToken(), null)
  assert.equal(current.window.sessionStorage.getItem(tokenKey), null)
  assert.equal(shared.get(tokenKey), "")
})

test("switching accounts clears previous WSS credentials but resaving the same account preserves them", async (t) => {
  const current = activate(
    t,
    page(
      new Map([
        [tokenKey, "account-a"],
        [wssKey, "shared-old"],
      ]),
      { [wssKey]: "tab-old" }
    )
  )
  const session = await loadSession()
  session.saveAccessToken("account-b")
  assert.equal(session.getAccessToken(), "account-b")
  assert.ok(!current.window.localStorage.getItem(wssKey))
  assert.ok(!current.window.sessionStorage.getItem(wssKey))
  current.window.localStorage.setItem(wssKey, "current-account-cache")
  session.saveAccessToken("account-b")
  assert.equal(
    current.window.localStorage.getItem(wssKey),
    "current-account-cache"
  )
})

test("a late unauthorized response cannot clear a newer remembered account", async (t) => {
  const current = activate(
    t,
    page(
      new Map([
        [tokenKey, "account-b"],
        [wssKey, "current-cache"],
      ])
    )
  )
  const session = await loadSession()
  session.clearAccessToken("account-a")
  session.clearAccessToken(null)
  assert.equal(session.getAccessToken(), "account-b")
  assert.equal(current.window.localStorage.getItem(wssKey), "current-cache")
  session.clearAccessToken("account-b")
  assert.equal(session.getAccessToken(), null)
  assert.equal(current.window.localStorage.getItem(tokenKey), "")
  assert.ok(!current.window.localStorage.getItem(wssKey))
})

test("an existing read-only remembered account cannot be silently replaced by an unusable tab login", async (t) => {
  const current = activate(
    t,
    page(
      new Map([
        [tokenKey, "account-a"],
        [wssKey, "shared-current-cache"],
      ]),
      { [wssKey]: "tab-current-cache" },
      { writeBlocked: true }
    )
  )
  const session = await loadSession()
  let changes = 0
  current.window.addEventListener(session.SESSION_CHANGED, () => changes++)
  assert.throws(() => session.saveAccessToken("account-b"), /lưu phiên/)
  assert.equal(session.getAccessToken(), "account-a")
  assert.equal(current.window.sessionStorage.getItem(tokenKey), null)
  assert.equal(
    current.window.localStorage.getItem(wssKey),
    "shared-current-cache"
  )
  assert.equal(
    current.window.sessionStorage.getItem(wssKey),
    "tab-current-cache"
  )
  assert.equal(changes, 0)
})

for (const blocked of [
  { readBlocked: true, writeBlocked: true },
  { writeBlocked: true },
])
  test(`restricted persistent storage still allows tab login (${blocked.readBlocked ? "read/write" : "write"} blocked)`, async (t) => {
    const current = activate(t, page(new Map(), {}, blocked))
    const session = await loadSession()
    assert.equal(session.getAccessToken(), null)
    session.saveAccessToken("fallback-account")
    assert.equal(session.getAccessToken(), "fallback-account")
    assert.equal(
      current.window.sessionStorage.getItem(tokenKey),
      "fallback-account"
    )
    session.clearAccessToken("fallback-account")
    assert.equal(session.getAccessToken(), null)
  })

test("storage events update other tabs once per account transition and ignore unrelated writes", async (t) => {
  const shared = new Map([[tokenKey, "account-a"]])
  const current = activate(t, page(shared, { [wssKey]: "old-tab-cache" }))
  const session = await loadSession()
  let changes = 0
  current.window.addEventListener(session.SESSION_CHANGED, () => changes++)
  const stop = session.watchStoredSession()
  t.after(stop)
  shared.set("theme", "dark")
  storageChanged(current, "theme")
  storageChanged(current)
  assert.equal(changes, 0)
  shared.set(tokenKey, "account-b")
  shared.set(wssKey, "new-account-cache")
  storageChanged(current)
  storageChanged(current)
  assert.equal(changes, 1)
  assert.equal(session.getAccessToken(), "account-b")
  assert.ok(!current.window.sessionStorage.getItem(wssKey))
  assert.equal(shared.get(wssKey), "new-account-cache")
  shared.set(tokenKey, "")
  current.window.sessionStorage.setItem(tokenKey, "account-a")
  storageChanged(current)
  assert.equal(changes, 2)
  assert.equal(session.getAccessToken(), null)
})

test("clearing site storage logs out another tab instead of reviving its legacy token", async (t) => {
  const shared = new Map([[tokenKey, "account-a"]])
  const current = activate(t, page(shared, { [tokenKey]: "account-a" }))
  const session = await loadSession()
  const stop = session.watchStoredSession()
  t.after(stop)
  current.window.sessionStorage.setItem(tokenKey, "account-a")
  shared.clear()
  storageChanged(current, null)
  assert.equal(session.getAccessToken(), null)
})

for (const eventName of ["focus", "pageshow", "visibilitychange"])
  test(`restored tabs resync a missed account change on ${eventName}`, async (t) => {
    const shared = new Map([[tokenKey, "account-a"]])
    const current = activate(t, page(shared))
    const session = await loadSession()
    let changes = 0
    current.window.addEventListener(session.SESSION_CHANGED, () => changes++)
    const stop = session.watchStoredSession()
    t.after(stop)
    shared.set(tokenKey, "account-b")
    const target =
      eventName === "visibilitychange" ? current.document : current.window
    if (eventName === "visibilitychange") {
      current.document.visibilityState = "hidden"
      target.dispatchEvent(new Event(eventName))
      assert.equal(changes, 0)
      current.document.visibilityState = "visible"
    }
    target.dispatchEvent(new Event(eventName))
    target.dispatchEvent(new Event(eventName))
    assert.equal(changes, 1)
    assert.equal(session.getAccessToken(), "account-b")
  })

test("local changes do not echo on focus and cleanup removes cross-tab listeners", async (t) => {
  const shared = new Map([[tokenKey, "account-a"]])
  const current = activate(t, page(shared))
  const session = await loadSession()
  let changes = 0
  current.window.addEventListener(session.SESSION_CHANGED, () => changes++)
  const stop = session.watchStoredSession()
  session.saveAccessToken("account-b")
  assert.equal(changes, 1)
  current.window.dispatchEvent(new Event("focus"))
  storageChanged(current)
  assert.equal(changes, 1)
  stop()
  stop()
  shared.set(tokenKey, "account-c")
  storageChanged(current)
  current.window.dispatchEvent(new Event("pageshow"))
  current.window.dispatchEvent(new Event("focus"))
  current.document.dispatchEvent(new Event("visibilitychange"))
  assert.equal(changes, 1)
})
