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
export function getSessionId(){return state.token}
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
const browserUrl = transpile("../src/api/chats/browser.ts", {
  "@/api/wss-client": clientUrl,
  "@/api/chats/routes": routesUrl,
  "@/lib/chat-upload": dataUrl(
    'export async function uploadChatFile(){throw new Error("Unexpected file upload")}'
  ),
})
const browser = await import(browserUrl)
const queries = await import(
  transpile("../src/api/chats/queries.ts", {
    "@/api/wss-client": clientUrl,
    "@/api/chats/browser": browserUrl,
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
  sessions.clearWssSession()
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

test("a usable ticket stays in memory and a reloaded page needs a new API ticket", async () => {
  const first = await sessions.getWssSession()
  assert.equal(window.localStorage.getItem("dealhay_wss_session"), null)
  assert.equal(window.sessionStorage.getItem("dealhay_wss_session"), null)
  assert.equal(state.apiCalls[0].path, "/private/realtime/socket-session")
  assert.equal(state.apiCalls[0].token, undefined)

  state.apiError = new Error("API is offline")
  assert.deepEqual(await sessions.getWssSession(), first)
  const reloaded = await import(
    transpile("../src/lib/wss-session.ts", imports, "\n// reload session module")
  )
  assert.equal(reloaded.cachedWssSession(), null)
  await assert.rejects(reloaded.getWssSession(), /API is offline/)
})

test("cached tickets cannot cross an account change", async () => {
  await sessions.getWssSession()
  state.token = "account-b"
  assert.equal(sessions.cachedWssSession(), null)
  state.token = "account-a"
  assert.equal(sessions.cachedWssSession(), null)
})

test("late rejection of an old ticket cannot clear a renewed ticket", async () => {
  const first = await sessions.getWssSession()
  state.response = { ...state.response, token: "b".repeat(64) }
  const renewed = await sessions.getWssSession(true)
  sessions.clearWssSession(first.token)
  assert.equal(sessions.cachedWssSession().token, renewed.token)
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
    if (new URL(url).pathname === "/chats")
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

test("compact chat snapshots restore message context without fetching history again", async (t) => {
  await sessions.getWssSession()
  const summary = { id: "room", slug: "shop-customer", counterpart: { id: "peer" } }
  const empty = { id: "support", slug: "support-room", is_support: true }
  const fetch = t.mock.method(globalThis, "fetch", async (url) => {
    assert.equal(new URL(url).pathname, "/chats")
    assert.equal(new URL(url).searchParams.get("view"), "compact")
    return Response.json({
      conversations: [empty, summary],
      messagesByConversation: { room: [{ id: "stored-message", body: "Xin chào" }] },
      admins: [],
    })
  })
  const result = await queries.getChats("shop-customer", 50)
  assert.equal(fetch.mock.callCount(), 1)
  assert.deepEqual(result.conversationSnapshots[0].messages, [])
  assert.deepEqual(result.selectedConversation, {
    ...summary,
    messages: [{ id: "stored-message", body: "Xin chào", conversation_id: "room" }],
    messages_pagination: { has_more: false, next_cursor: null },
  })
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

test("a rejected ticket is renewed once and retries the chat request", async (t) => {
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

test("a guarded chat request cannot use a new account after asynchronous session lookup", async (t) => {
  const owner = state.token
  const originalGet = sessions.getWssSession
  await originalGet()
  let current = true
  t.mock.method(globalThis, "fetch", async () => assert.fail("Obsolete request must not reach WSS"))
  const request = wssFetch({ path: "/chat-uploads/images", method: "POST", body: {} }, () => current && state.token === owner)
  current = false
  state.token = "account-b"
  await assert.rejects(request, /Phiên đăng nhập đã thay đổi/)
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
