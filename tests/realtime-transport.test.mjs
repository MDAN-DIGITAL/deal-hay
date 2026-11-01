import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

const moduleUrl = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
function transpile(file, imports = {}) {
  const { outputText } = ts.transpileModule(
    readFileSync(new URL(file, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    }
  )
  return moduleUrl(
    outputText.replace(/from (["'])([^"']+)\1/g, (_, quote, specifier) => {
      assert.ok(imports[specifier], `Unexpected import: ${specifier}`)
      return `from ${quote}${imports[specifier]}${quote}`
    })
  )
}
globalThis.__directTransport = { token: "account-token", clears: 0 }
const clientUrl = transpile("../src/api/client.ts", {
  "@/config/env": moduleUrl(
    'export const env = { API_URL: "https://api.example.test/api" }'
  ),
  "@/lib/session": moduleUrl(`
    export function getAccessToken() { return globalThis.__directTransport.token }
    export function clearAccessToken() { globalThis.__directTransport.token = null; globalThis.__directTransport.clears++ }
  `),
})
const { apiFetch, ApiError } = await import(clientUrl)
const liveUrl = transpile("../src/api/live-client.ts", {
  "@/api/client": clientUrl,
})
const { liveApiFetch } = await import(liveUrl)

function reset() {
  globalThis.__directTransport = { token: "account-token", clears: 0 }
}

test("API requests forward an abort signal so a stalled Backend cannot block the WSS test", async (t) => {
  reset()
  const signal = new AbortController().signal
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    assert.equal(options.signal, signal)
    return Response.json({ ok: true })
  })
  assert.deepEqual(
    await apiFetch({
      method: "POST",
      path: "/diagnostics/speedtest/session",
      signal,
    }),
    { ok: true }
  )
})

test("chat, presence and session requests run concurrently directly against API", async (t) => {
  reset()
  const pending = []
  t.mock.method(
    globalThis,
    "fetch",
    (url, options) =>
      new Promise((resolve) => pending.push({ url, options, resolve }))
  )
  const counts = liveApiFetch("/auth/me")
  const heartbeat = liveApiFetch("/presence/heartbeat", {
    method: "POST",
    body: {},
  })
  const send = liveApiFetch("/messages/customer-shop", {
    method: "POST",
    body: { body: "Xin chào" },
  })
  assert.equal(pending.length, 3)
  assert.deepEqual(
    pending.map(({ url }) => url),
    [
      "https://api.example.test/api/auth/me",
      "https://api.example.test/api/presence/heartbeat",
      "https://api.example.test/api/messages/customer-shop",
    ]
  )
  for (const { options } of pending) {
    assert.equal(options.headers.get("Authorization"), "Bearer account-token")
    assert.equal(options.credentials, "omit")
    assert.equal(options.cache, "no-store")
    assert.equal(options.redirect, "error")
  }
  pending[2].resolve(Response.json({ id: "sent" }))
  assert.deepEqual(await send, { id: "sent" })
  pending[0].resolve(Response.json({ count: 1 }))
  pending[1].resolve(Response.json({ ok: true }))
  await Promise.all([counts, heartbeat])
})

test("multipart chat requests preserve attachment, idempotency and socket headers", async (t) => {
  reset()
  const body = new FormData()
  body.set("body", "File đính kèm")
  body.set(
    "attachment",
    new File(["content"], "receipt.pdf", { type: "application/pdf" })
  )
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "https://api.example.test/api/messages/shop-chat")
    assert.equal(options.body, body)
    assert.equal(options.headers.get("Content-Type"), null)
    assert.equal(options.headers.get("Idempotency-Key"), "client-message-key")
    assert.equal(options.headers.get("X-Socket-ID"), "socket-id")
    return Response.json({ id: "message" }, { status: 201 })
  })
  assert.deepEqual(
    await liveApiFetch("/messages/shop-chat", {
      method: "POST",
      body,
      headers: {
        "Idempotency-Key": "client-message-key",
        "X-Socket-ID": "socket-id",
      },
    }),
    { id: "message" }
  )
})

test("API query values are encoded and anonymous calls omit the account token", async (t) => {
  reset()
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(
      url,
      "https://api.example.test/api/?q=a%26b&page=2&available=false"
    )
    assert.equal(options.headers.get("Authorization"), null)
    return Response.json({ products: [] })
  })
  await apiFetch({
    path: "/",
    token: null,
    searchParams: {
      q: "a&b",
      page: 2,
      available: false,
      empty: "",
      missing: undefined,
    },
  })
})

test("validation errors retain API status and field errors", async (t) => {
  reset()
  const errors = { body: ["Nội dung quá dài."] }
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({ message: "Dữ liệu không hợp lệ.", errors }, { status: 422 })
  )
  await assert.rejects(
    liveApiFetch("/messages/shop-chat", { method: "POST", body: {} }),
    (error) => {
      assert.ok(error instanceof ApiError)
      assert.equal(error.status, 422)
      assert.deepEqual(error.errors, errors)
      return true
    }
  )
  assert.equal(globalThis.__directTransport.token, "account-token")
})

test("revoked account tokens clear the current browser session", async (t) => {
  reset()
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({ message: "Unauthenticated." }, { status: 401 })
  )
  await assert.rejects(
    liveApiFetch("/auth/me"),
    (error) => error.status === 401
  )
  assert.equal(globalThis.__directTransport.token, null)
  assert.equal(globalThis.__directTransport.clears, 1)
})

test("a delayed response for an old token cannot clear a newer login", async (t) => {
  reset()
  let complete
  t.mock.method(
    globalThis,
    "fetch",
    () =>
      new Promise((resolve) => {
        complete = resolve
      })
  )
  const request = liveApiFetch("/auth/me")
  globalThis.__directTransport.token = "new-account-token"
  complete(Response.json({ message: "Unauthenticated." }, { status: 401 }))
  await assert.rejects(request, (error) => error.status === 401)
  assert.equal(globalThis.__directTransport.token, "new-account-token")
  assert.equal(globalThis.__directTransport.clears, 0)
})

test("empty successful API responses do not attempt JSON parsing", async (t) => {
  reset()
  t.mock.method(
    globalThis,
    "fetch",
    async () => new Response(null, { status: 204 })
  )
  assert.equal(
    await liveApiFetch("/notifications/read", { method: "PATCH", body: {} }),
    undefined
  )
})
