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

test.beforeEach(() => {
  const storage = new Map()
  globalThis.window = {
    sessionStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
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
  window.sessionStorage.setItem("dealhay_wss_session", JSON.stringify(entry))
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
