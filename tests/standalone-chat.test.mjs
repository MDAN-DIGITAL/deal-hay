import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import ts from "typescript"

const dataUrl = (source) =>
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
function transpile(file, imports = {}, suffix = "") {
  const source = ts
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
  return dataUrl(source + suffix)
}
const mocks = dataUrl(`
export const state={token:'account-a',apiCalls:[],apiError:null,response:null}
export function getAccessToken(){return state.token}
export class ApiError extends Error {constructor(status,payload){super(payload.message);this.status=status;this.errors=payload.errors}}
export async function apiFetch(options){state.apiCalls.push(options);if(state.apiError)throw state.apiError;return state.response}
`)
const { state, ApiError } = await import(mocks)
const imports = {
  zod: import.meta.resolve("zod"),
  "@/api/client": mocks,
  "@/lib/session": mocks,
}
const sessionUrl = transpile("../src/lib/wss-session.ts", imports)
const sessions = await import(sessionUrl)
const clientUrl = transpile("../src/api/wss-client.ts", {
  "@/api/client": mocks,
  "@/lib/wss-session": sessionUrl,
})
const { wssFetch } = await import(clientUrl)
const routesUrl = transpile("../src/api/chats/routes.ts")
const browser = await import(
  transpile("../src/api/chats/browser.ts", {
    "@/api/wss-client": clientUrl,
    "@/api/chats/routes": routesUrl,
    "@/lib/chat-upload": dataUrl(
      'export async function uploadChatFile(){throw new Error("Unexpected file upload")}'
    ),
  })
)
const queries = await import(
  transpile("../src/api/chats/queries.ts", {
    "@/api/wss-client": clientUrl,
    "@/api/chats/routes": routesUrl,
    "@/lib/wss-session": sessionUrl,
  })
)

function storage(values = {}) {
  const entries = new Map(Object.entries(values))
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: (key) => entries.delete(key),
  }
}

test.beforeEach(() => {
  globalThis.window = {
    sessionStorage: storage(),
    localStorage: storage(),
  }
  state.token = "account-a"
  state.apiCalls = []
  state.apiError = null
  state.response = {
    token: "a".repeat(64),
    url: "https://wss.example.test",
    expires_at: Math.floor(Date.now() / 1000) + 86400,
  }
})

test("a server-owned session survives a page reload and API outage without another API call", async () => {
  const first = await sessions.getWssSession()
  assert.equal(state.apiCalls.length, 1)
  state.apiError = new Error("API is offline")
  const reloaded = await import(
    transpile(
      "../src/lib/wss-session.ts",
      imports,
      "\n// reload session module"
    )
  )
  assert.deepEqual(await reloaded.getWssSession(), first)
  assert.equal(state.apiCalls.length, 1)
  assert.equal(state.apiCalls[0].path, "/private/realtime/socket-session")
  assert.equal(state.apiCalls[0].token, "account-a")
})

test("cached WSS credentials never cross account changes or an expired session", async () => {
  await sessions.getWssSession()
  state.token = "account-b"
  state.apiError = new Error("API offline")
  assert.equal(await sessions.cachedWssSession(), null)
  await assert.rejects(sessions.getWssSession(), /API offline/)
  state.token = "account-a"
  const entry = JSON.parse(window.sessionStorage.getItem("dealhay_wss_session"))
  entry.session.expires_at = Math.floor(Date.now() / 1000) - 1
  window.localStorage.setItem("dealhay_wss_session", JSON.stringify(entry))
  assert.equal(await sessions.cachedWssSession(), null)
})

test("a native new chat tab and browser reopen reuse the remembered WSS session while API is offline", async () => {
  const first = await sessions.getWssSession()
  const shared = window.localStorage
  globalThis.window = { localStorage: shared, sessionStorage: storage() }
  state.apiError = new Error("API offline")
  const freshTab = await import(
    transpile("../src/lib/wss-session.ts", imports, "\n// native new tab")
  )
  assert.deepEqual(await freshTab.getWssSession(), first)
  assert.equal(state.apiCalls.length, 1)
  assert.equal(
    JSON.parse(window.sessionStorage.getItem("dealhay_wss_session")).session
      .token,
    first.token
  )
})

test("only an account-matching unexpired legacy WSS credential migrates to shared storage", async () => {
  await sessions.getWssSession()
  const legacy = window.sessionStorage.getItem("dealhay_wss_session")
  window.localStorage.removeItem("dealhay_wss_session")
  state.token = "account-b"
  assert.equal(await sessions.cachedWssSession(), null)
  assert.equal(window.localStorage.getItem("dealhay_wss_session"), null)
  state.token = "account-a"
  assert.ok(await sessions.cachedWssSession())
  assert.equal(window.localStorage.getItem("dealhay_wss_session"), legacy)
})

test("shared WSS revocation and expired records never resurrect another tab's legacy credential", async () => {
  await sessions.getWssSession()
  const valid = window.sessionStorage.getItem("dealhay_wss_session")
  sessions.clearWssSession()
  window.sessionStorage.setItem("dealhay_wss_session", valid)
  assert.equal(await sessions.cachedWssSession(), null)
  const expired = JSON.parse(valid)
  expired.session.expires_at = Math.floor(Date.now() / 1000) - 1
  window.localStorage.setItem("dealhay_wss_session", JSON.stringify(expired))
  assert.equal(await sessions.cachedWssSession(), null)
  const malformed = "not json"
  window.localStorage.setItem("dealhay_wss_session", malformed)
  assert.equal(await sessions.cachedWssSession(), null)
})

test("a logout arriving while a legacy WSS record is validated prevents migration", async (t) => {
  await sessions.getWssSession()
  window.localStorage.removeItem("dealhay_wss_session")
  const digest = crypto.subtle.digest.bind(crypto.subtle)
  let finish
  t.mock.method(
    crypto.subtle,
    "digest",
    (algorithm, input) =>
      new Promise((resolve) => {
        finish = async () => resolve(await digest(algorithm, input))
      })
  )
  const validating = sessions.cachedWssSession()
  window.localStorage.setItem("dealhay_wss_session", "")
  await finish()
  assert.equal(await validating, null)
  assert.equal(window.localStorage.getItem("dealhay_wss_session"), "")
})

test("late rejection of an old WSS credential cannot clear a newer shared session", async () => {
  const first = await sessions.getWssSession()
  const renewed = JSON.parse(window.localStorage.getItem("dealhay_wss_session"))
  renewed.session.token = "b".repeat(64)
  window.localStorage.setItem("dealhay_wss_session", JSON.stringify(renewed))
  sessions.clearWssSession(first.token)
  assert.equal((await sessions.cachedWssSession()).token, "b".repeat(64))
})

test("WSS login remains usable when persistent browser storage is blocked", async () => {
  Object.defineProperty(window, "localStorage", {
    get() {
      throw new DOMException("Blocked", "SecurityError")
    },
  })
  const first = await sessions.getWssSession()
  state.apiError = new Error("API offline")
  assert.deepEqual(await sessions.getWssSession(), first)
  assert.equal(state.apiCalls.length, 1)
  sessions.clearWssSession(first.token)
  assert.equal(await sessions.cachedWssSession(), null)
})

test("concurrent initial chat operations share one bootstrap request", async () => {
  const result = await Promise.all([
    sessions.getWssSession(),
    sessions.getWssSession(),
    sessions.getWssSession(),
  ])
  assert.equal(state.apiCalls.length, 1)
  assert.equal(new Set(result.map(({ token }) => token)).size, 1)
})

test("chat history, writes, read receipts and presence go directly to WSS during API outage", async (t) => {
  await sessions.getWssSession()
  state.apiError = new Error("API offline")
  const calls = []
  t.mock.method(globalThis, "fetch", async (url, options) => {
    calls.push({ url, options })
    if (url.endsWith("/chats"))
      return Response.json({ conversations: [], selectedConversation: null })
    if (url.includes("/messages?"))
      return Response.json({ messages: [], has_more: false, next_cursor: null })
    return Response.json({ id: "message-id", ok: true })
  })
  await browser.getChats()
  await browser.getChatHistory("shop-customer", "cursor-id", 20)
  const message = new FormData()
  message.set("body", "Hello from a standalone socket server")
  message.set("reply_to_id", "original-message")
  await browser.sendChatMessage(
    "shop-customer",
    message,
    "client-id",
    "socket-id"
  )
  await browser.markConversationRead("shop-customer")
  await browser.recordPresenceHeartbeat("conversation-id")
  assert.deepEqual(
    calls.map(({ url }) => new URL(url).pathname),
    [
      "/chats",
      "/chats/shop-customer/messages",
      "/chats/shop-customer/messages",
      "/chats/shop-customer/read",
      "/presence/heartbeat",
    ]
  )
  for (const { url, options } of calls) {
    assert.equal(new URL(url).origin, "https://wss.example.test")
    assert.equal(
      options.headers.get("Authorization"),
      `Bearer ${"a".repeat(64)}`
    )
    assert.equal(options.credentials, "omit")
    assert.equal(options.redirect, "error")
  }
  assert.deepEqual(JSON.parse(calls[2].options.body), {
    body: "Hello from a standalone socket server",
    client_message_id: "client-id",
    reply_to_id: "original-message",
  })
  assert.equal(calls[2].options.headers.get("Idempotency-Key"), "client-id")
  assert.equal(state.apiCalls.length, 1)
})

test("the chat page combines WSS summaries and paginated history without API detail requests", async (t) => {
  await sessions.getWssSession()
  state.apiError = new Error("API offline")
  const summary = {
    id: "conversation",
    slug: "shop-customer",
    counterpart: { id: "peer" },
  }
  const calls = []
  t.mock.method(globalThis, "fetch", async (url) => {
    calls.push(url)
    return Response.json(
      url.includes("/messages")
        ? {
            messages: [{ id: "stored-in-sqlite" }],
            has_more: true,
            next_cursor: "cursor",
          }
        : { conversations: [summary], selectedConversation: null }
    )
  })
  const result = await queries.getChats("shop-customer", 50)
  assert.equal(result.selectedConversation.id, "conversation")
  assert.deepEqual(result.selectedConversation.messages, [
    { id: "stored-in-sqlite" },
  ])
  assert.deepEqual(result.selectedConversation.messages_pagination, {
    has_more: true,
    next_cursor: "cursor",
  })
  assert.equal(calls.length, 2)
  assert.equal(state.apiCalls.length, 1)
})

test("a rejected WSS credential is removed without logging out the API account", async (t) => {
  await sessions.getWssSession()
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({ message: "Session revoked" }, { status: 401 })
  )
  await assert.rejects(
    wssFetch({ path: "/auth/me" }),
    (error) => error instanceof ApiError && error.status === 401
  )
  assert.equal(await sessions.cachedWssSession(), null)
  assert.equal(state.token, "account-a")
})

test("a RAM database restart renews its scoped credential once and retries the chat request", async (t) => {
  await sessions.getWssSession()
  state.response = { ...state.response, token: "b".repeat(64) }
  const credentials = []
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    const credential = options.headers.get("Authorization")
    credentials.push(credential)
    return credential === `Bearer ${"a".repeat(64)}`
      ? Response.json({ message: "Session revoked" }, { status: 401 })
      : Response.json({ conversations: [] })
  })
  assert.deepEqual(await wssFetch({ path: "/chats" }), { conversations: [] })
  assert.deepEqual(credentials, [
    `Bearer ${"a".repeat(64)}`,
    `Bearer ${"b".repeat(64)}`,
  ])
  assert.equal(state.apiCalls.length, 2)
  assert.equal((await sessions.cachedWssSession()).token, "b".repeat(64))
  assert.equal(state.token, "account-a")
})

test("a repeatedly rejected WSS session stops after one renewal", async (t) => {
  await sessions.getWssSession()
  let calls = 0
  t.mock.method(globalThis, "fetch", async () => {
    calls++
    return Response.json({ message: "Session revoked" }, { status: 401 })
  })
  await assert.rejects(
    wssFetch({ path: "/chats" }),
    (error) => error.status === 401
  )
  assert.equal(calls, 2)
  assert.equal(state.apiCalls.length, 2)
  assert.equal(await sessions.cachedWssSession(), null)
  assert.equal(state.token, "account-a")
})

test("WSS requests forward cancellation so push settings cannot stall logout", async (t) => {
  await sessions.getWssSession()
  const controller = new AbortController()
  let started
  const fetching = new Promise((resolve) => {
    started = resolve
  })
  t.mock.method(globalThis, "fetch", (_url, options) => {
    assert.equal(options.signal, controller.signal)
    started()
    return new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () =>
        reject(options.signal.reason)
      )
    })
  })
  const request = wssFetch({
    path: "/push/subscriptions",
    method: "DELETE",
    body: { endpoint: "https://push.example.test/subscription" },
    signal: controller.signal,
  })
  await fetching
  controller.abort()
  await assert.rejects(request, { name: "AbortError" })
  assert.ok(await sessions.cachedWssSession())
})

test("logout revokes only the WSS-owned session then clears its local cache", async (t) => {
  await sessions.getWssSession()
  const calls = []
  t.mock.method(globalThis, "fetch", async (url, options) => {
    calls.push({ url, options })
    return new Response(null, { status: 204 })
  })
  await sessions.revokeWssSession()
  assert.equal(calls[0].url, "https://wss.example.test/auth/logout")
  assert.equal(
    calls[0].options.headers.Authorization,
    `Bearer ${"a".repeat(64)}`
  )
  assert.equal(await sessions.cachedWssSession(), null)
})

test("logout for an old account never revokes the new account's remembered WSS credential", async (t) => {
  await sessions.getWssSession()
  state.token = "account-b"
  state.response = { ...state.response, token: "b".repeat(64) }
  const newer = await sessions.getWssSession()
  t.mock.method(globalThis, "fetch", async () => {
    assert.fail("The old account must not revoke the current session")
  })
  await sessions.revokeWssSession("account-a")
  assert.deepEqual(await sessions.cachedWssSession(), newer)
})

test("a pending logout response never clears another account's freshly issued WSS session", async (t) => {
  await sessions.getWssSession()
  let finish, started
  const requestStarted = new Promise((resolve) => {
    started = resolve
  })
  t.mock.method(globalThis, "fetch", async () => {
    started()
    return new Promise((resolve) => {
      finish = resolve
    })
  })
  const revocation = sessions.revokeWssSession("account-a")
  await requestStarted
  state.token = "account-b"
  state.response = { ...state.response, token: "b".repeat(64) }
  const newer = await sessions.getWssSession()
  finish(new Response(null, { status: 204 }))
  await revocation
  assert.deepEqual(await sessions.cachedWssSession(), newer)
})

test("the chat page preloads all conversations in one snapshot request", async (t) => {
  await sessions.getWssSession()
  const selected = {
    id: "conversation",
    slug: "shop-customer",
    counterpart: { id: "peer" },
    messages: [{ id: "all-history" }],
    messages_pagination: { has_more: false, next_cursor: null },
  }
  const calls = []
  t.mock.method(globalThis, "fetch", async (url) => {
    calls.push(url)
    return Response.json({
      conversations: [selected],
      selectedConversation: null,
      conversationSnapshots: [selected],
      admins: [{ id: "admin", name: "Support" }],
    })
  })
  const result = await queries.getChats("shop-customer", 50)
  assert.equal(calls.length, 1)
  assert.deepEqual(result.selectedConversation, selected)
  assert.deepEqual(result.admins, [{ id: "admin", name: "Support" }])
})

test("an old generated support link selects preloaded legacy history through its alias", async (t) => {
  await sessions.getWssSession()
  const selected = {
    id: "original-room",
    slug: "original-admin-chat",
    counterpart: { id: "admin" },
    messages: [{ id: "kept-history" }],
    messages_pagination: { has_more: false, next_cursor: null },
  }
  const aliases = [
    {
      id: "empty-room",
      slug: "empty-generated-room",
      target_id: selected.id,
      target_slug: selected.slug,
    },
  ]
  let calls = 0
  t.mock.method(globalThis, "fetch", async () => {
    calls++
    return Response.json({
      conversations: [selected],
      conversationSnapshots: [selected],
      conversationAliases: aliases,
      selectedConversation: null,
    })
  })
  const result = await queries.getChats("empty-generated-room")
  assert.equal(calls, 1)
  assert.equal(result.selectedConversation.id, selected.id)
  assert.deepEqual(result.selectedConversation.messages, [
    { id: "kept-history" },
  ])
  assert.deepEqual(result.conversationAliases, aliases)
})
