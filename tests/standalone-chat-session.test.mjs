import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

const url = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
function module(file, imports) {
  return url(
    ts
      .transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX,
        },
      })
      .outputText.replace(/from (["'])([^"']+)\1/g, (_, quote, name) => {
        assert.ok(imports[name], `Unexpected import ${name}`)
        return `from ${quote}${imports[name]}${quote}`
      })
  )
}
const react = url(`
export function createContext(){return{Provider:'session-provider'}}
export function useContext(){return globalThis.__standaloneSession.value}
export function useState(initial){return globalThis.__standaloneSession.component.useState(initial)}
export function useEffect(effect,deps){return globalThis.__standaloneSession.component.useEffect(effect,deps)}
`)
const mocked = url(`
export const state={account:null,fallback:null,cache:null,profile:null,calls:0}
export function getCurrentSession(){return state.account}
export async function getCachedChatSession(){return state.fallback}
export async function cachedWssSession(){return state.cache}
export async function wssFetch(){state.calls++;return state.profile}
export const DATA_CHANGED='data', SESSION_CHANGED='session'
export function usePathname(){return globalThis.__standaloneSession.path}
export function useRouter(){return{replace:path=>globalThis.__standaloneSession.destinations.push(path)}}
`)
const { state } = await import(mocked)
const jsx = url(
  "export const jsx=(type,props)=>({type,props}); export const jsxs=jsx"
)
const { SessionProvider, AuthGuard, GuestGuard } = await import(
  module("../src/components/session-provider.tsx", {
    react,
    "react/jsx-runtime": jsx,
    "next/navigation": mocked,
    "@/api/auth/queries": mocked,
    "@/api/chats/session": mocked,
    "@/components/layout/page-loading": url("export default 'loading'"),
    "@/lib/auth-redirect": module("../src/lib/auth-redirect.ts", {}),
    "@/lib/query-cache": mocked,
    "@/lib/session": mocked,
  })
)
const { getCachedChatSession } = await import(
  module("../src/api/chats/session.ts", {
    "@/api/wss-client": mocked,
    "@/lib/wss-session": mocked,
  })
)
function deferred() {
  let resolve
  const promise = new Promise((done) => {
    resolve = done
  })
  return { promise, resolve }
}
const settle = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve()
}
function component() {
  return {
    slots: [],
    cursor: 0,
    useState(initial) {
      const index = this.cursor++
      if (!(index in this.slots))
        this.slots[index] = typeof initial === "function" ? initial() : initial
      return [
        this.slots[index],
        (next) => {
          this.slots[index] =
            typeof next === "function" ? next(this.slots[index]) : next
        },
      ]
    },
    useEffect(effect, deps) {
      const index = this.cursor++,
        previous = this.slots[index]
      if (
        !previous ||
        deps.some((value, i) => !Object.is(value, previous.deps[i]))
      ) {
        previous?.cleanup?.()
        this.slots[index] = { deps, cleanup: effect() }
      }
    },
    dispose() {
      for (const slot of this.slots) slot?.cleanup?.()
    },
  }
}
function render(fn, props, hooks = component()) {
  globalThis.__standaloneSession.component = hooks
  hooks.cursor = 0
  const result = fn(props)
  if (result.type === "session-provider")
    globalThis.__standaloneSession.value = result.props.value
  return result
}
test.beforeEach(() => {
  globalThis.window = Object.assign(new EventTarget(), {
    location: { pathname: "/chats/shop-customer", search: "" },
  })
  globalThis.__standaloneSession = {
    path: "/chats/shop-customer",
    destinations: [],
    value: null,
    component: null,
  }
  state.account = new Promise(() => {})
  state.fallback = {
    user: {
      id: "owner",
      full_name: "Owner",
      role: "administrator",
      is_active: true,
    },
    unreadCounts: { messages: 4, notifications: 0 },
  }
  state.cache = null
  state.profile = null
  state.calls = 0
})
test("chat renders a WSS-verified identity while the API request remains unavailable", async (t) => {
  const hooks = component()
  t.after(() => hooks.dispose())
  render(SessionProvider, { children: "chat" }, hooks)
  await settle()
  render(SessionProvider, { children: "chat" }, hooks)
  assert.equal(globalThis.__standaloneSession.value.loading, false)
  assert.equal(globalThis.__standaloneSession.value.offlineChat, true)
  assert.equal(globalThis.__standaloneSession.value.user.id, "owner")
  assert.equal(render(AuthGuard, { children: "chat" }), "chat")
  assert.deepEqual(globalThis.__standaloneSession.destinations, [])
})
test("an offline chat identity never grants access to admin or non-chat routes", async (t) => {
  const hooks = component()
  t.after(() => hooks.dispose())
  render(SessionProvider, { children: "chat" }, hooks)
  await settle()
  render(SessionProvider, { children: "chat" }, hooks)
  assert.equal(
    render(AuthGuard, { children: "admin", admin: true }).type,
    "loading"
  )
  globalThis.__standaloneSession.path = "/private/profile"
  assert.equal(render(AuthGuard, { children: "profile" }).type, "loading")
  assert.equal(globalThis.__standaloneSession.destinations.length, 2)
})

test("a valid cached WSS identity also opens diagnostics without granting business permissions", async (t) => {
  globalThis.__standaloneSession.path = "/diagnostics"
  const hooks = component()
  t.after(() => hooks.dispose())
  render(SessionProvider, { children: "diagnostics" }, hooks)
  await settle()
  render(SessionProvider, { children: "diagnostics" }, hooks)
  assert.equal(globalThis.__standaloneSession.value.offlineChat, true)
  assert.equal(render(AuthGuard, { children: "diagnostics" }), "diagnostics")
  assert.equal(
    render(AuthGuard, { children: "admin", admin: true }).type,
    "loading"
  )
})
test("a non-chat page cannot bootstrap its identity from a cached chat profile", async (t) => {
  globalThis.__standaloneSession.path = "/private/profile"
  const hooks = component()
  t.after(() => hooks.dispose())
  render(SessionProvider, { children: "profile" }, hooks)
  await settle()
  render(SessionProvider, { children: "profile" }, hooks)
  assert.equal(globalThis.__standaloneSession.value.user, null)
  assert.equal(globalThis.__standaloneSession.value.offlineChat, false)
})
test("restored API identity replaces the restricted chat identity", async (t) => {
  const request = deferred()
  state.account = request.promise
  const hooks = component()
  t.after(() => hooks.dispose())
  render(SessionProvider, { children: "chat" }, hooks)
  await settle()
  render(SessionProvider, { children: "chat" }, hooks)
  request.resolve({
    user: { id: "owner", full_name: "API owner", role: "administrator" },
    unreadCounts: { messages: 0, notifications: 3 },
  })
  await settle()
  render(SessionProvider, { children: "chat" }, hooks)
  assert.equal(globalThis.__standaloneSession.value.offlineChat, false)
  assert.equal(globalThis.__standaloneSession.value.user.full_name, "API owner")
  assert.equal(render(AuthGuard, { children: "admin", admin: true }), "admin")
})
test("a chat-only fallback cannot redirect the sign-in page away from reauthentication", () => {
  globalThis.__standaloneSession.value = {
    ...state.fallback,
    loading: false,
    offlineChat: true,
  }
  assert.equal(render(GuestGuard, { children: "sign-in" }), "sign-in")
  assert.deepEqual(globalThis.__standaloneSession.destinations, [])
})
test("cached chat identity is accepted only after WSS verifies the credential and active user", async () => {
  assert.equal(await getCachedChatSession(), null)
  assert.equal(state.calls, 0)
  state.cache = { token: "credential" }
  state.profile = {
    user: {
      id: "owner",
      full_name: "Owner",
      role: "customer",
      is_active: true,
    },
    unreadCounts: { messages: 2, notifications: 0 },
  }
  const response = await getCachedChatSession()
  assert.equal(response.user.id, "owner")
  assert.equal(response.user.email, "")
  state.profile.user.is_active = false
  assert.equal(await getCachedChatSession(), null)
  assert.equal(state.calls, 2)
})
