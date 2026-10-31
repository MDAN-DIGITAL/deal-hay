import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

const url = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
const react = url(`
export function useState(value) { return globalThis.__queryHarness.useState(value) }
export function useEffect(effect, deps) { return globalThis.__queryHarness.useEffect(effect, deps) }
`)
const api = url(
  `export class ApiError extends Error { constructor(status) { super("failed");this.status=status } }`
)
const session = url(
  `export const SESSION_CHANGED="session";export function getAccessToken() { return globalThis.__queryToken }`
)
const imports = {
  react,
  "react/jsx-runtime": import.meta.resolve("react/jsx-runtime"),
  "next/navigation": url(
    `export function useRouter() { return globalThis.__queryRouter }`
  ),
  "@/api/client": api,
  "@/components/layout/page-loading": url(`export default "loading"`),
  "@/components/layout/page-not-found": url(`export default "not-found"`),
  "@/components/ui/button": url(`export const Button="button"`),
  "@/lib/query-cache": url(
    `export const DATA_CHANGED="data"; export function invalidateQueries() { window.dispatchEvent(new Event("data")) }`
  ),
  "@/lib/session": session,
}
const source = ts
  .transpileModule(
    readFileSync(
      new URL("../src/hooks/use-api-query.tsx", import.meta.url),
      "utf8"
    ),
    {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }
  )
  .outputText.replace(/from (["'])([^"']+)\1/g, (_, quote, name) => {
    assert.ok(imports[name], `Unexpected import ${name}`)
    return `from ${quote}${imports[name]}${quote}`
  })
const { useApiQuery: renderQueryHook } = await import(url(source))
const { ApiError } = await import(api)
const flush = async () => {
  for (let i = 0; i < 4; i++) await Promise.resolve()
}
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
function mount(t) {
  globalThis.__queryToken = "account-a"
  globalThis.window = Object.assign(new EventTarget(), {
    location: { pathname: "/chats", search: "?page=2" },
  })
  const destinations = []
  globalThis.__queryRouter = { replace: (path) => destinations.push(path) }
  const slots = []
  let cursor = 0,
    effects = []
  globalThis.__queryHarness = {
    useState(initial) {
      const index = cursor++
      if (!(index in slots))
        slots[index] = typeof initial === "function" ? initial() : initial
      return [
        slots[index],
        (value) => {
          slots[index] =
            typeof value === "function" ? value(slots[index]) : value
        },
      ]
    },
    useEffect(effect, deps) {
      const index = cursor++
      const previous = slots[index]
      if (!previous || deps.some((dep, i) => !Object.is(dep, previous.deps[i])))
        effects.push(() => {
          previous?.cleanup?.()
          slots[index] = { deps, cleanup: effect() }
        })
    },
  }
  const render = (key, loader) => {
    cursor = 0
    effects = []
    const result = renderQueryHook(key, loader)
    for (const effect of effects) effect()
    return result
  }
  t.after(() => {
    for (const slot of slots) slot?.cleanup?.()
    delete globalThis.__queryHarness
  })
  return { render, destinations }
}

test("client queries ignore the previous route response and refresh after mutations", async (t) => {
  const { render } = mount(t)
  const oldRequest = deferred(),
    current = deferred(),
    refresh = deferred()
  render("old-route", () => oldRequest.promise)
  assert.equal(render("new-route", () => current.promise).data, undefined)
  current.resolve({ id: "current" })
  await flush()
  oldRequest.resolve({ id: "old" })
  await flush()
  assert.deepEqual(render("new-route", () => refresh.promise).data, {
    id: "current",
  })
  window.dispatchEvent(new Event("data"))
  render("new-route", () => refresh.promise)
  refresh.resolve({ id: "updated" })
  await flush()
  assert.deepEqual(render("new-route", () => refresh.promise).data, {
    id: "updated",
  })
})

test("changing account clears rendered data and an old account request cannot replace the new result", async (t) => {
  const { render } = mount(t)
  const first = deferred(),
    next = deferred()
  render("profile", () => first.promise)
  globalThis.__queryToken = "account-b"
  window.dispatchEvent(new Event("session"))
  assert.equal(render("profile", () => next.promise).data, undefined)
  next.resolve({ user: "b" })
  await flush()
  first.resolve({ user: "a" })
  await flush()
  assert.deepEqual(render("profile", () => next.promise).data, { user: "b" })
})

test("expired API sessions keep the current destination for sign-in", async (t) => {
  const { render, destinations } = mount(t)
  render("chats", async () => {
    throw new ApiError(401)
  })
  await flush()
  assert.deepEqual(destinations, ["/sign-in?redirect=%2Fchats%3Fpage%3D2"])
})

test("a delayed 401 from the previous account cannot redirect a new session before its next render", async (t) => {
  const { render, destinations } = mount(t)
  const oldRequest = deferred()
  render("profile", () => oldRequest.promise)
  globalThis.__queryToken = "account-b"
  window.dispatchEvent(new Event("session"))
  oldRequest.reject(new ApiError(401))
  await flush()
  assert.deepEqual(destinations, [])
  assert.equal(render("profile", async () => ({ user: "b" })).data, undefined)
  await flush()
  assert.deepEqual(render("profile", async () => ({ user: "b" })).data, {
    user: "b",
  })
})
