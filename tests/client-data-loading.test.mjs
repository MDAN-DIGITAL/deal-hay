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
  const render = (key, loader, options) => {
    cursor = 0
    effects = []
    const result = renderQueryHook(key, loader, options)
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

test("a public server snapshot renders immediately and revalidates the current browser viewer", async (t) => {
  const { render } = mount(t)
  const request = deferred()
  const publicSnapshot = { name: "Sản phẩm công khai", canReview: false }
  const options = { initialData: publicSnapshot }
  let requestedAs
  const load = () => {
    requestedAs = globalThis.__queryToken
    return request.promise
  }
  assert.deepEqual(render("product", load, options).data, publicSnapshot)
  assert.equal(requestedAs, "account-a")
  request.resolve({ ...publicSnapshot, canReview: true })
  await flush()
  assert.equal(render("product", load, options).data.canReview, true)
})

test("an anonymous product snapshot skips the duplicate viewer request", (t) => {
  const { render } = mount(t)
  globalThis.__queryToken = null
  let requests = 0
  const snapshot = { name: "Sản phẩm công khai", canReview: false }
  const result = render(
    "product",
    async () => {
      requests++
      return snapshot
    },
    { initialData: snapshot, revalidateOnMount: "authenticated" }
  )

  assert.deepEqual(result.data, snapshot)
  assert.equal(requests, 0)
})

test("a complete anonymous snapshot skips the duplicate mount request and survives session restoration", async (t) => {
  const { render } = mount(t)
  const refresh = deferred()
  const snapshot = { products: ["Server product"] }
  let requests = 0
  const load = () => {
    requests++
    return refresh.promise
  }
  const options = {
    initialData: snapshot,
    revalidateOnMount: false,
    sessionSensitive: false,
  }

  assert.deepEqual(render("home", load, options).data, snapshot)
  assert.equal(requests, 0)

  globalThis.__queryToken = "account-b"
  window.dispatchEvent(new Event("session"))
  assert.deepEqual(render("home", load, options).data, snapshot)
  assert.equal(requests, 0)

  window.dispatchEvent(new Event("data"))
  assert.deepEqual(render("home", load, options).data, snapshot)
  assert.equal(requests, 1)
  refresh.resolve({ products: ["Updated product"] })
  await flush()
  assert.deepEqual(render("home", load, options).data, {
    products: ["Updated product"],
  })
})

test("disabling mount revalidation still loads when the server has no snapshot", async (t) => {
  const { render } = mount(t)
  const request = deferred()
  let requests = 0
  const load = () => {
    requests++
    return request.promise
  }

  assert.equal(
    render("home", load, { revalidateOnMount: false }).data,
    undefined
  )
  assert.equal(requests, 1)
  request.resolve({ products: ["Browser product"] })
  await flush()
  assert.deepEqual(render("home", load, { revalidateOnMount: false }).data, {
    products: ["Browser product"],
  })
})

test("server seeds belong to their route and are not restored over an account change", async (t) => {
  const { render } = mount(t)
  const first = deferred()
  const next = deferred()
  render("old-product", () => first.promise, {
    initialData: { id: "old-public-product" },
  })
  const options = { initialData: { id: "new-public-product" } }
  assert.deepEqual(render("new-product", () => next.promise, options).data, {
    id: "new-public-product",
  })
  first.resolve({ id: "old-private-product" })
  await flush()
  assert.deepEqual(render("new-product", () => next.promise, options).data, {
    id: "new-public-product",
  })
  next.resolve({ id: "new-private-product" })
  await flush()
  globalThis.__queryToken = "account-b"
  window.dispatchEvent(new Event("session"))
  assert.equal(
    render("new-product", async () => ({ id: "account-b" }), options).data,
    undefined
  )
  await flush()
  assert.deepEqual(
    render("new-product", async () => ({ id: "account-b" }), options).data,
    { id: "account-b" }
  )
})

test("a failed server load stays pending while the browser recovery request runs", async (t) => {
  const { render } = mount(t)
  const request = deferred()
  const options = { initialError: "Không thể tải nội dung." }
  const initial = render("home", () => request.promise, options)
  assert.equal(initial.data, undefined)
  assert.equal(initial.error, undefined)
  request.resolve({ products: ["Recovered product"] })
  await flush()
  const recovered = render("home", () => request.promise, options)
  assert.deepEqual(recovered.data, { products: ["Recovered product"] })
  assert.equal(recovered.error, undefined)
})

test("a server failure is shown only after the browser recovery request also fails", async (t) => {
  const { render } = mount(t)
  const request = deferred()
  const options = { initialError: "Không thể tải nội dung." }
  assert.equal(
    render("product", () => request.promise, options).error,
    undefined
  )
  request.reject(new Error("Browser recovery failed"))
  await flush()
  assert.equal(
    render("product", () => request.promise, options).error.message,
    "Browser recovery failed"
  )
})
