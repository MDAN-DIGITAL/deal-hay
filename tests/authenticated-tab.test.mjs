import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

const moduleUrl = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
const session = moduleUrl(`
  export const ACCESS_TOKEN_STORAGE_KEY='dealhay_access_token'
  export const ACCESS_TOKEN_SESSION_ONLY_KEY='dealhay_access_token_session_only'
  export const getAccessToken=()=>globalThis.__tabAccount
`)
const source = ts
  .transpileModule(
    readFileSync(
      new URL("../src/lib/authenticated-tab.ts", import.meta.url),
      "utf8"
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    }
  )
  .outputText.replace(/from (["'])@\/lib\/session\1/, `from "${session}"`)
const { openAuthenticatedTab } = await import(moduleUrl(source))

function browser(t, { blocked = false, storageFailure = false } = {}) {
  const values = new Map()
  const destinations = []
  const page = {
    opener: {},
    sessionStorage: {
      setItem(key, value) {
        if (storageFailure) throw new Error("storage unavailable")
        values.set(key, value)
      },
    },
    location: {
      replace(href) {
        destinations.push(href)
      },
    },
    close() {
      page.closed = true
    },
  }
  const calls = []
  globalThis.window = {
    location: { origin: "https://dealhay.example" },
    open(...args) {
      calls.push(args)
      return blocked ? null : page
    },
  }
  globalThis.__tabAccount = "test-temporary-session"
  t.after(() => {
    delete globalThis.window
    delete globalThis.__tabAccount
  })
  return { page, values, destinations, calls }
}
const click = (options = {}) => ({
  button: 0,
  defaultPrevented: false,
  currentTarget: {
    href: "https://dealhay.example/shop-manage?tab=orders#order-1",
  },
  preventDefault() {
    this.defaultPrevented = true
  },
  ...options,
})

test("a new seller tab keeps the temporary login and deep link without exposing its opener", (t) => {
  const state = browser(t)
  const event = click()
  openAuthenticatedTab(event)
  assert.deepEqual(state.calls, [["about:blank", "_blank"]])
  assert.equal(state.page.opener, null)
  assert.equal(
    state.values.get("dealhay_access_token"),
    "test-temporary-session"
  )
  assert.equal(state.values.get("dealhay_access_token_session_only"), "1")
  assert.deepEqual(state.destinations, ["/shop-manage?tab=orders#order-1"])
  assert.equal(event.defaultPrevented, true)
})

test("blocked popups and unavailable storage preserve the native link fallback", (t) => {
  let state = browser(t, { blocked: true })
  let event = click()
  openAuthenticatedTab(event)
  assert.equal(event.defaultPrevented, false)
  assert.deepEqual(state.destinations, [])
  state = browser(t, { storageFailure: true })
  event = click()
  openAuthenticatedTab(event)
  assert.equal(event.defaultPrevented, false)
  assert.equal(state.page.closed, true)
})

test("guest, cross-origin and cancelled/native modifier clicks are not intercepted", (t) => {
  const state = browser(t)
  for (const options of [
    { defaultPrevented: true },
    { altKey: true },
    { shiftKey: true },
    { button: 2 },
    { currentTarget: { href: "https://another.example/shop-manage" } },
  ])
    openAuthenticatedTab(click(options))
  globalThis.__tabAccount = null
  openAuthenticatedTab(click())
  assert.deepEqual(state.calls, [])
})

test("middle, ctrl and meta clicks open one authenticated tab", (t) => {
  const state = browser(t)
  for (const options of [{ button: 1 }, { ctrlKey: true }, { metaKey: true }]) {
    const event = click(options)
    openAuthenticatedTab(event)
    assert.equal(event.defaultPrevented, true)
  }
  assert.equal(state.calls.length, 3)
})
